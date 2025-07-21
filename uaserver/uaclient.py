import logging
from opcua import Client, ua
import threading
from queue import Queue, Empty
import time

_logger = logging.getLogger(__name__)

class RobotAvailabilityHandler:
    """Handler class for robot availability data change notifications"""

    def __init__(self, ua_client):
        self.ua_client = ua_client

    def datachange_notification(self, node, val, data):
        """Handle data change notifications for robot availability"""
        try:
            with self.ua_client.robot_available_lock:
                self.ua_client.robot_available = val
                if val:
                    self.ua_client.robot_available_event.set()
                else:
                    self.ua_client.robot_available_event.clear()
            _logger.info(f"Robot availability changed to: {val}")
        except Exception as e:
            _logger.error(f"Error handling robot availability change: {e}")

class UAClient:
    _instance = None  # Singleton pattern
    def __new__(cls, *args, **kwargs):
        if cls._instance is None:
            cls._instance = super(UAClient, cls).__new__(cls)
        return cls._instance

    def __init__(self, endpoint="opc.tcp://127.0.0.8:4840/freeopcua/server/"):
        if not hasattr(self, 'initialized'):
            self.endpoint = endpoint
            self.client = None
            self.connected = False
            self.initialized = True
            self.node_cache = {}
            self.start_signal = None
            self.subscription = None
            self.subscription_handle = None
            # Add robot availability
            self.robot_available = True
            self.robot_available_lock = threading.Lock()
            self.robot_available_event = threading.Event()
            self.robot_available_event.set()  # Initially set as available
            # Create handler for robot availability changes
            self.robot_handler = RobotAvailabilityHandler(self)

    def connect(self):
        """Connect to OPC UA server"""
        try:
            self.client = Client(self.endpoint)
            self.client.connect()
            self.connected = True
            _logger.info("Successfully connected to OPC UA server")

            # Get root node
            root = self.client.get_root_node()

            # Cache commonly used nodes
            try:
                self.myobj = root.get_child(["0:Objects", "2:MyObject"])
                self._myvar_x = self.myobj.get_child("2:MyVariableX")
                self._myvar_y = self.myobj.get_child("2:MyVariableY")
                self._grid_m = self.myobj.get_child("2:GridM")
                self._grid_n = self.myobj.get_child("2:GridN")
                self.lv = self.myobj.get_child("2:StainLevel")
                self.machine_id = self.myobj.get_child("2:MachineID")
                self.robot_available_node = self.myobj.get_child("2:RobotAvailable")
                self.start_signal = self.myobj.get_child("2:ActionSignal")

                # Subscribe to RobotAvailable variable with proper handler
                self.subscription = self.client.create_subscription(500, self.robot_handler)
                self.subscription_handle = self.subscription.subscribe_data_change(self.robot_available_node)

                # Store variables in cache
                self.node_cache = {
                    'x': self._myvar_x,
                    'y': self._myvar_y,
                    'm': self._grid_m,
                    'n': self._grid_n,
                    'lv': self.lv,
                    'mach_id': self.machine_id,
                    'start_signal': self.start_signal
                }

                _logger.info("Successfully retrieved OPC UA nodes and set up subscription")
            except Exception as e:
                _logger.error(f"Failed to get nodes: {e}")
                self.disconnect()

        except Exception as e:
            _logger.error(f"Connection to OPC UA server failed: {e}")
            self.connected = False

    def disconnect(self):
        """Disconnect from OPC UA server"""
        try:
            # Clean up subscription
            if self.subscription and self.subscription_handle:
                self.subscription.unsubscribe(self.subscription_handle)
                self.subscription_handle = None

            if self.subscription:
                self.subscription.delete()
                self.subscription = None

            if self.client and self.connected:
                self.client.disconnect()

        except Exception as e:
            _logger.error(f"Error during disconnect: {e}")
        finally:
            self.connected = False
            _logger.info("Disconnected from OPC UA server")

    def ensure_connected(self):
        """Ensure client is connected, try to connect if not"""
        if not self.connected:
            self.connect()

    def wait_for_robot_available(self, timeout=None):
        """Wait for robot to be available"""
        return self.robot_available_event.wait(timeout)

    def get_robot_availability(self):
        """Get current robot availability status"""
        with self.robot_available_lock:
            return self.robot_available

    def update_variables(self, x=None, y=None, m=None, n=None, lv=None, mach_id=None):
        """
        Update variables on OPC UA server
        """
        result = {"success": True, "failed_updates": []}

        try:
            self.ensure_connected()

            # Wait for robot to be available
            if not self.wait_for_robot_available(timeout=30):  # 30 seconds timeout
                result["success"] = False
                result["error"] = "Timeout waiting for robot to become available"
                return result

            # Set action signal
            self.start_signal.set_value(False)
            time.sleep(0.3)
            self.start_signal.set_value(True)

            # Update variables
            if x is not None:
                self._myvar_x.set_value(x)
            if y is not None:
                self._myvar_y.set_value(y)
            if m is not None:
                self._grid_m.set_value(m)
            if n is not None:
                self._grid_n.set_value(n)
            if lv is not None:
                self.lv.set_value(lv)
            if mach_id is not None:
                self.machine_id.set_value(mach_id)

            # Validate write operations
            current_values = {
                "x": self._myvar_x.get_value() if x is not None else None,
                "y": self._myvar_y.get_value() if y is not None else None,
                "m": self._grid_m.get_value() if m is not None else None,
                "n": self._grid_n.get_value() if n is not None else None,
            }

            # Reset action signal
            self.start_signal.set_value(False)

            # Check values
            for var_name, expected, actual in [
                ("x", x, current_values["x"]),
                ("y", y, current_values["y"]),
                ("m", m, current_values["m"]),
                ("n", n, current_values["n"]),
            ]:
                if expected is not None and expected != actual:
                    result["failed_updates"].append({
                        "variable": var_name,
                        "expected": expected,
                        "actual": actual
                    })

            if result["failed_updates"]:
                result["success"] = False
                _logger.warning(f"Some variable updates failed: {result['failed_updates']}")
            else:
                _logger.info(f"Successfully updated variables: x={x}, y={y}, m={m}, n={n}")

        except Exception as e:
            _logger.error(f"Error updating variables: {e}")
            result["success"] = False
            result["error"] = str(e)

        return result

    @classmethod
    def get_client(cls):
        """Get connected client instance"""
        client = cls()
        client.ensure_connected()
        return client

    def __del__(self):
        """Cleanup when object is destroyed"""
        try:
            self.disconnect()
        except:
            pass