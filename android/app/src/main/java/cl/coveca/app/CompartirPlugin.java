package cl.coveca.app;

import android.content.ActivityNotFoundException;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import java.io.OutputStream;
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

    /**
     * Guarda un archivo (ej. PDF de un reporte) en Descargas/COVECA y lo abre con el visor del celular.
     * Si no hay visor, abre el menú Compartir.
     */
    @PluginMethod
    public void guardarArchivo(PluginCall call) {
        String base64 = call.getString("base64");
        String nombre = call.getString("nombre", "reporte.pdf");
        String mime = call.getString("mime", "application/pdf");
        if (base64 == null) { call.reject("Falta el contenido del archivo."); return; }
        try {
            byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
            Uri uri;
            String ubicacion;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentResolver cr = getContext().getContentResolver();
                ContentValues v = new ContentValues();
                v.put(MediaStore.MediaColumns.DISPLAY_NAME, nombre);
                v.put(MediaStore.MediaColumns.MIME_TYPE, mime);
                v.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/COVECA");
                uri = cr.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
                if (uri == null) throw new Exception("No se pudo crear el archivo en Descargas.");
                try (OutputStream out = cr.openOutputStream(uri)) { out.write(bytes); }
                ubicacion = "Descargas/COVECA";
            } else {
                File dir = new File(getContext().getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), "COVECA");
                dir.mkdirs();
                File f = new File(dir, nombre);
                try (FileOutputStream out = new FileOutputStream(f)) { out.write(bytes); }
                uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", f);
                ubicacion = f.getAbsolutePath();
            }
            Intent ver = new Intent(Intent.ACTION_VIEW);
            ver.setDataAndType(uri, mime);
            ver.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            try {
                getActivity().startActivity(ver);
            } catch (ActivityNotFoundException e) {
                Intent env = new Intent(Intent.ACTION_SEND);
                env.setType(mime);
                env.putExtra(Intent.EXTRA_STREAM, uri);
                env.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                getActivity().startActivity(Intent.createChooser(env, "Abrir o compartir reporte"));
            }
            com.getcapacitor.JSObject r = new com.getcapacitor.JSObject();
            r.put("ubicacion", ubicacion);
            call.resolve(r);
        } catch (Exception e) {
            call.reject("No se pudo guardar el archivo: " + e.getMessage());
        }
    }

    /** Abre un enlace en el navegador del celular (ej. descargar la actualización). */
    @PluginMethod
    public void abrirUrl(PluginCall call) {
        String url = call.getString("url");
        if (url == null) { call.reject("Falta el enlace."); return; }
        try {
            Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getActivity().startActivity(i);
            call.resolve();
        } catch (Exception e) {
            call.reject("No se pudo abrir el enlace: " + e.getMessage());
        }
    }

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
