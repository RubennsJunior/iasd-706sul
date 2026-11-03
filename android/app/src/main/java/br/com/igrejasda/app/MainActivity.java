package br.com.igrejasda.app;

import android.os.Bundle;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    // A barra que mostra a posição da rolagem é desenhada pelo próprio WebView; o CSS não a esconde.
    WebView webView = getBridge().getWebView();
    webView.setVerticalScrollBarEnabled(false);
    webView.setHorizontalScrollBarEnabled(false);
  }
}
