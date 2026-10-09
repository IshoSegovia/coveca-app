package cl.coveca.app;

import android.Manifest;
import android.annotation.SuppressLint;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothSocket;
import android.content.Context;
import android.os.Build;
import android.util.Base64;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.OutputStream;
import java.util.Set;
import java.util.UUID;

/**
 * Impresión ESC/POS por Bluetooth clásico (perfil serie SPP).
 * La impresora debe estar vinculada previamente en los ajustes de Bluetooth de Android.
 */
@CapacitorPlugin(
    name = "BtPrinter",
    permissions = {
        @Permission(alias = "bluetooth", strings = { Manifest.permission.BLUETOOTH_CONNECT, Manifest.permission.BLUETOOTH_SCAN })
    }
)
public class BtPrinterPlugin extends Plugin {

    private static final UUID SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");

    private boolean needsRuntimePermission() {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.S;
    }

    private BluetoothAdapter adapter() {
        BluetoothManager m = (BluetoothManager) getContext().getSystemService(Context.BLUETOOTH_SERVICE);
        return m == null ? null : m.getAdapter();
    }

    /** Pide permiso si hace falta y luego ejecuta el método solicitado. */
    private boolean ensurePermission(PluginCall call) {
        if (needsRuntimePermission() && getPermissionState("bluetooth") != PermissionState.GRANTED) {
            requestPermissionForAlias("bluetooth", call, "permissionCallback");
            return false;
        }
        return true;
    }

    @PermissionCallback
    private void permissionCallback(PluginCall call) {
        if (getPermissionState("bluetooth") != PermissionState.GRANTED) {
            call.reject("Permiso de Bluetooth denegado. Actívalo en Ajustes > Apps > COVECA > Permisos.");
            return;
        }
        if ("listPaired".equals(call.getMethodName())) {
            listPaired(call);
        } else if ("print".equals(call.getMethodName())) {
            print(call);
        }
    }

    @SuppressLint("MissingPermission")
    @PluginMethod
    public void listPaired(PluginCall call) {
        if (!ensurePermission(call)) return;
        BluetoothAdapter ad = adapter();
        if (ad == null) { call.reject("Este celular no tiene Bluetooth."); return; }
        if (!ad.isEnabled()) { call.reject("El Bluetooth está apagado. Enciéndelo y vuelve a intentar."); return; }
        Set<BluetoothDevice> bonded = ad.getBondedDevices();
        JSArray list = new JSArray();
        for (BluetoothDevice d : bonded) {
            JSObject o = new JSObject();
            o.put("name", d.getName() == null ? "(sin nombre)" : d.getName());
            o.put("address", d.getAddress());
            list.put(o);
        }
        JSObject ret = new JSObject();
        ret.put("devices", list);
        call.resolve(ret);
    }

    @SuppressLint("MissingPermission")
    @PluginMethod
    public void print(PluginCall call) {
        if (!ensurePermission(call)) return;
        final String address = call.getString("address");
        final String data = call.getString("data");
        if (address == null || data == null) { call.reject("Falta la impresora o el contenido a imprimir."); return; }
        final BluetoothAdapter ad = adapter();
        if (ad == null || !ad.isEnabled()) { call.reject("El Bluetooth está apagado."); return; }

        new Thread(() -> {
            BluetoothSocket socket = null;
            try {
                ad.cancelDiscovery();
                BluetoothDevice device = ad.getRemoteDevice(address);
                socket = device.createRfcommSocketToServiceRecord(SPP_UUID);
                socket.connect();
                OutputStream out = socket.getOutputStream();
                byte[] bytes = Base64.decode(data, Base64.DEFAULT);
                // Envío continuo en bloques: suficientemente rápido para que la impresora
                // no se detenga (evita líneas/tirones), sin saturar su memoria.
                int chunk = 1024;
                for (int i = 0; i < bytes.length; i += chunk) {
                    out.write(bytes, i, Math.min(chunk, bytes.length - i));
                    out.flush();
                    Thread.sleep(8);
                }
                // Esperar a que termine de imprimir antes de cerrar la conexión
                // (cerrar antes corta la nota). ~1 s por cada 8 KB, mínimo 1,5 s.
                Thread.sleep(Math.max(1500, bytes.length / 8));
                call.resolve();
            } catch (Exception e) {
                call.reject("No se pudo imprimir: revisa que la impresora esté encendida y cerca. (" + e.getMessage() + ")");
            } finally {
                if (socket != null) {
                    try { socket.close(); } catch (Exception ignored) {}
                }
            }
        }).start();
    }
}
