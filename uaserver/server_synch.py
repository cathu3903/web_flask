import logging
import time

from opcua import Server, ua


_server = None
_myvar_x = None
_myvar_y = None
_grid_m = None
_grid_n = None
Lv = None
MachID = None
RobotAvailable = None
ActionSignal = None

def callback(ch, method, properties, body):
    print(f"[x] Received {body}")

def run():
    global _server, _myvar_x, _myvar_y, _grid_m, _grid_n
    _logger = logging.getLogger(__name__)

    try:
        # setup server
        _server = Server()

        _server.set_endpoint("opc.tcp://127.0.0.8:4840/freeopcua/server/")

        uri = "http://my_ua_server"
        idx =  _server.register_namespace(uri)

        obj = _server.get_objects_node()

        myobj = obj.add_object(idx, "MyObject")

        _myvar_x =  myobj.add_variable(idx, "MyVariableX", 0)
        _myvar_y =  myobj.add_variable(idx, "MyVariableY", 0)
        _grid_m =  myobj.add_variable(idx, "GridM", 10)
        _grid_n =  myobj.add_variable(idx, "GridN", 10)
        Lv =  myobj.add_variable(idx, "StainLevel", 0)
        MachID =  myobj.add_variable(idx, "MachineID", 0)
        RobotAvailable =  myobj.add_variable(idx, "RobotAvailable", True)
        ActionSignal =  myobj.add_variable(idx, "ActionSignal", False)

        _myvar_x.set_writable()
        _myvar_y.set_writable()
        _grid_m.set_writable()
        _grid_n.set_writable()
        RobotAvailable.set_writable()
        ActionSignal.set_writable()

        _logger.info("Starting server!")
        _server.start()

        try:
            while True:
                time.sleep(2)
                continue
        finally:
            _server.stop()


    except Exception as e:
        _logger.error(f"Server initialization failed: {e}")

if __name__ == "__main__":
    # logging.basicConfig(level=logging.DEBUG)
    run()