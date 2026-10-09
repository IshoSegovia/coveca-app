package cl.coveca.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(BtPrinterPlugin.class);
        registerPlugin(CompartirPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
