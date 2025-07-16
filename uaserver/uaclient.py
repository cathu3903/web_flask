import asyncio
import logging
from asyncua import Client, ua

_logger = logging.getLogger(__name__)

class UAClient:
    _instance = None  # 单例模式
    def __new__(cls, *args, **kwargs):
        if cls._instance is None:
            cls._instance = super(UAClient, cls).__new__(cls)
        return cls._instance

    def __init__(self, endpoint="opc.tcp://localhost:4840/freeopcua/server/"):
        if not hasattr(self, 'initialized'):
            self.endpoint = endpoint
            self.client = None
            self.connected = False
            self.initialized = True
            self.node_cache = {}
            self.start_signal = None
            # Add robot availability
            self.robot_available = True
            self.condition = asyncio.Condition()

    async def connect(self):
        """连接到OPC UA服务器"""
        try:
            self.client = Client(self.endpoint)
            await self.client.connect()
            self.connected = True
            _logger.info("Successfully connected to OPC UA server")

            # 获取根节点
            root = self.client.nodes.root

            # 缓存常用节点
            try:
                self.myobj = await root.get_child(["0:Objects", "2:MyObject"])
                self._myvar_x = await self.myobj.get_child("2:MyVariableX")
                self._myvar_y = await self.myobj.get_child("2:MyVariableY")
                self._grid_m = await self.myobj.get_child("2:GridM")
                self._grid_n = await self.myobj.get_child("2:GridN")
                self.lv = await self.myobj.get_child("2:StainLevel")
                self.machine_id = await self.myobj.get_child("2:MachineID")
                self.robot_available = await self.myobj.get_child("2:RobotAvailable")
                self.start_signal = await self.myobj.get_child("2:ActionSignal")

                # 将变量存储在缓存中
                self.node_cache = {
                    'x': self._myvar_x,
                    'y': self._myvar_y,
                    'm': self._grid_m,
                    'n': self._grid_n,
                    'lv': self.lv,
                    'mach_id': self.machine_id,
                    'start_signal': self.start_signal
                }

                _logger.info("Successfully retrieved OPC UA nodes")
            except Exception as e:
                _logger.error(f"Failed to get nodes: {e}")
                await self.disconnect()

        except Exception as e:
            _logger.error(f"Connection to OPC UA server failed: {e}")
            self.connected = False

    async def disconnect(self):
        """断开与OPC UA服务器的连接"""
        if self.client and self.connected:
            await self.client.disconnect()
        self.connected = False
        _logger.info("Disconnected from OPC UA server")

    async def ensure_connected(self):
        """确保客户端已连接，如果未连接则尝试连接"""
        if not self.connected:
            await self.connect()

    async def on_robot_available_change(self, datachange_notification):
        """处理机器人可用性更改"""
        value = datachange_notification.MonitoredItem.Value.Value.Value
        async with self.condition:
            self.robot_available = value
            self.condition.notify_all() # 唤醒所有等待的协程

    async def ensure_robot_available(self):
        """确保机器人可用"""
        async with self.condition:
            while not self.robot_available:
                await self.condition.wait()

    async def update_variables(self, x=None, y=None, m=None, n=None, lv=None, mach_id=None):
        """
        更新OPC UA服务器上的变量

        Args:
            x (int): 值来更新 MyVariableX
            y (int): 值来更新 MyVariableY
            m (int): 值来更新 GridM
            n (int): 值来更新 GridN

        Returns:
            dict: 包含成功和失败信息的字典
        """
        result = {"success": True, "failed_updates": []}

        try:
            await self.ensure_connected()
            await self.start_signal.write_value(True)
            # if no value provided, use default values
            if x is not None:
                await self._myvar_x.write_value(x)
            if y is not None:
                await self._myvar_y.write_value(y)
            if m is not None:
                await self._grid_m.write_value(m)
            if n is not None:
                await self._grid_n.write_value(n)

            # valid the writing operation
            current_values = {
                "x": await self._myvar_x.get_value() if x is not None else None,
                "y": await self._myvar_y.get_value() if y is not None else None,
                "m": await self._grid_m.get_value() if m is not None else None,
                "n": await self._grid_n.get_value() if n is not None else None,
                # "lv": await self._stain_level.get_value() if lv is not None else None,
                # "mach_id": await self._machine_id.get_value() if mach_id is not None else None,
            }
            await asyncio.sleep(5)
            # await self.start_signal.write_value(False)

            # check the values
            if x is not None and current_values["x"] != x:
                result["failed_updates"].append({"variable": "x", "expected": x, "actual": current_values["x"]})
            if y is not None and current_values["y"] != y:
                result["failed_updates"].append({"variable": "y", "expected": y, "actual": current_values["y"]})
            if m is not None and current_values["m"] != m:
                result["failed_updates"].append({"variable": "m", "expected": m, "actual": current_values["m"]})
            if n is not None and current_values["n"] != n:
                result["failed_updates"].append({"variable": "n", "expected": n, "actual": current_values["n"]})

            if result["failed_updates"]:
                result["success"] = False
                _logger.warning(f"Some variable updates failed: {result['failed_updates']}")
            else:
                _logger.info(f"Successfully updated variables: x={x}, y={y}, m={m}, n={n}")
            return result

        except Exception as e:
            _logger.error(f"Error updating variables: {e}")
            result["success"] = False
            result["error"] = str(e)
            return result

    @classmethod
    async def get_client(cls):
        """获取已连接的客户端实例"""
        client = cls()
        await client.ensure_connected()
        return client