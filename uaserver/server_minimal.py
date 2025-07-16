import asyncio
import logging
import threading

import pika

from asyncua import Server, ua, crypto
from asyncua.common.methods import uamethod

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

async def main():
    global _server, _myvar_x, _myvar_y, _grid_m, _grid_n
    _logger = logging.getLogger(__name__)

    try:
        # setup server
        _server = Server()
        await _server.init()
        _server.set_endpoint("opc.tcp://localhost:4840/freeopcua/server/")

        uri = "http://my_ua_server"
        idx = await _server.register_namespace(uri)

        myobj = await _server.nodes.objects.add_object(idx, "MyObject")
        _myvar_x = await myobj.add_variable(idx, "MyVariableX", 0)
        _myvar_y = await myobj.add_variable(idx, "MyVariableY", 0)
        _grid_m = await myobj.add_variable(idx, "GridM", 10)
        _grid_n = await myobj.add_variable(idx, "GridN", 10)
        Lv = await myobj.add_variable(idx, "StainLevel", 0)
        MachID = await myobj.add_variable(idx, "MachineID", 0)
        RobotAvailable = await myobj.add_variable(idx, "RobotAvailable", True)
        ActionSignal = await myobj.add_variable(idx, "ActionSignal", False)

        await _myvar_x.set_writable()
        await _myvar_y.set_writable()
        await _grid_m.set_writable()
        await _grid_n.set_writable()
        await RobotAvailable.set_writable()
        await ActionSignal.set_writable()

        # # RabbitMQ connection
        # connection = pika.BlockingConnection(pika.ConnectionParameters('localhost'))
        # channel = connection.channel()
        # # declare a queue
        # channel.queue_declare(queue='robot_queue', durable=True)

        # # receive message from robot_queue
        # channel.basic_consume(queue='robot_queue', on_message_callback=callback, auto_ack=True)

        # print('Waiting for messages...')
        # channel.start_consuming()

        # # set up our own namespace, not really necessary but should as spec
        # uri = "http://my_ua_server"
        # idx = await _server.register_namespace(uri)

        # populating our address space
        # server.nodes, contains links to very common nodes like objects and root
        # myobj = await _server.nodes.objects.add_object(idx, "MyObject")
        # myvar = await myobj.add_variable(idx, "MyVariable", True)
        # # myvar_to_client = await myobj.add_variable(idx, "MyVariableToClient", True)
        # _myvar_x = await myobj.add_variable(idx, "MyVariableX", 0)
        # _myvar_y = await myobj.add_variable(idx, "MyVariableY", 0)
        # _grid_m = await myobj.add_variable(idx, "GridM", 10)
        # _grid_n = await myobj.add_variable(idx, "GridN", 10)

        # await _myvar_x.set_subscribed(True)
        # await _myvar_y.set_subscribed(True)
        # await _grid_m.set_subscribed(True)
        # await _grid_n.set_subscribed(True)

        # Set MyVariable to be writable by clients
        # await myvar.set_writable()

        # # Add a new method to the server
        # await _server.nodes.objects.add_method(
        #     ua.NodeId("ServerMethod", idx),
        #     ua.QualifiedName("ServerMethod", idx),
        #     [ua.VariantType.Int64],
        #     [ua.VariantType.Int64],
        # )
        _logger.info("Starting server!")
        async with _server:
            while True:
                await asyncio.sleep(5)
                # value_1 = await myvar.get_value()


                # myvar_to_client.set_value(not value_2)

                # print(f"Current value of MyVariable 1 (bool): {value_1}")
                # print(f"Current value of MyVariable 2 (bool): {await myvar_to_client.get_value()}")
                value_x = await _myvar_x.get_value()
                value_y = await _myvar_y.get_value()
                value_m = await _grid_m.get_value()
                value_n = await _grid_n.get_value()
                value_lv = await Lv.get_value()
                value_mach_id = await MachID.get_value()
                value_available = await RobotAvailable.get_value()
                value_start = await ActionSignal.get_value()
                print(f"Current value of MyVariableX (int): {value_x}")
                print(f"Current value of MyVariableY (int): {value_y}")
                print(f"Current value of MyVariableM (int): {value_m}")
                print(f"Current value of MyVariableN (int): {value_n}")
                print(f"Current value of MyVariableLV (int): {value_lv}")
                print(f"Current value of MyVariableMachID (int): {value_mach_id}")
                print(f"Current value of RobotAvailable (bool): {value_available}")
                print(f"Current value of RobotStartSignal (bool): {value_start}")


                # await myvar.write_value(value + 1)

                # if value_y > 1000:
                #     await myvar_y.write_value(500)
                #     await myvar_to_client.write_value(not value_2)
                # else:
                #     if value_x > 1200:
                #         await myvar_x.write_value(500)
                #         await myvar_y.write_value(value_y + 100)
                #         await myvar_to_client.write_value(not value_2)
                #     else:
                #         await myvar_x.write_value(value_x + 100)
                #         await myvar_to_client.write_value(not value_2)

                # await asyncio.sleep(3)
                # new_val = await myvar.get_value() + 0.1
                # _logger.info("Set value of %s to %.1f", myvar, new_val)
                # await myvar.write_value(new_val)
    except Exception as e:
        _logger.error(f"Server initialization failed: {e}")



async def update_variables(x, y, m, n, lv=0, mach_id=0):
    """external function to update variables

    Args:
        x (int): x coordinate of grids
        y (int): y coordinate of grids
        m (int): number of columnns
        n (int): number of raws
        lv (int): stain level--0, 1, 2, 3, 4,
        mach_id (int): machine id
    """
    global _server, _myvar_x, _myvar_y, _grid_m, _grid_n, Lv, MachID, ActionSignal
    if _server is None:
        raise RuntimeError("Server not initialized")

    print("Entered update_variables()")
    try:
        await ActionSignal.write_value(True)
        await _myvar_x.write_value(x)
        await _myvar_y.write_value(y)
        await _grid_m.write_value(m)
        await _grid_n.write_value(n)
        await Lv.write_value(lv)
        await MachID.write_value(mach_id)

        # valid the update
        current_x = await _myvar_x.get_value()
        current_y = await _myvar_y.get_value()
        print(f"[DEBUG] Post-write verification: x={current_x}, y={current_y}")

        print(f"[SUCCESS] Updated: x={x}, y={y}, m={m}, n={n}, lv={lv}, mach_id={mach_id}")
    except Exception as e:
        print(f"[ERROR] Update failed: {type(e).__name__}: {str(e)}")
        import traceback
        print(f"[ERROR] Traceback: {traceback.format_exc()}")


if __name__ == "__main__":
    logging.basicConfig(level=logging.DEBUG)
    asyncio.run(main(), debug=True)