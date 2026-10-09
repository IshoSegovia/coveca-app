package cl.coveca.app;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.util.Base64;

import androidx.core.content.FileProvider;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;

/**
 * Comparte la imagen de la nota por WhatsApp.
 * Si se indica el teléfono del cliente, abre directo su chat; si no, WhatsApp pide elegir el contacto.
 * Si WhatsApp no está instalado, muestra el menú normal de "Compartir".
 */
@CapacitorPlugin(name = "Compartir")
public class CompartirPlugin extends Plugin {

    @PluginMethod
    public void whatsapp(PluginCall call) {
        String imagen = call.getString("imagen");   // PNG en base64 (sin "data:")
        String telefono = call.getString("telefono"); // solo dígitos con código país, ej. 56912345678
        String texto = call.getString("texto", "");
        if (imagen == null) { call.reject("Falta la imagen de la nota."); return; }
        try {
            File dir = new File(getContext().getCacheDir(), "notas");
            dir.mkdirs();
            File archivo = new File(dir, "nota-coveca.png");
            try (FileOutputStream out = new FileOutputStream(archivo)) {
                out.write(Base64.decode(imagen, Base64.DEFAULT));
            }
            Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", archivo);

            Intent intent = new Intent(Intent.ACTION_SEND);
            intent.setType("image/png");
            intent.putExtra(Intent.EXTRA_STREAM, uri);
            if (!texto.isEmpty()) intent.putExtra(Intent.EXTRA_TEXT, texto);
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            if (telefono != null && !telefono.isEmpty()) {
                intent.putExtra("jid", telefono.replaceAll("\\D", "") + "@s.whatsapp.net");
            }

            for (String paquete : new String[] { "com.whatsapp", "com.whatsapp.w4b" }) {
                try {
                    intent.setPackage(paquete);
                    getActivity().startActivity(intent);
                    call.resolve();
                    return;
                } catch (ActivityNotFoundException ignored) { }
            }
            intent.setPackage(null);
            intent.removeExtra("jid");
            getActivity().startActivity(Intent.createChooser(intent, "Enviar nota"));
            call.resolve();
        } catch (Exception e) {
            call.reject("No se pudo compartir la nota: " + e.getMessage());
        }
    }
}
