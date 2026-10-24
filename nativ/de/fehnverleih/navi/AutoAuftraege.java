package de.fehnverleih.navi;

import androidx.car.app.CarContext;
import androidx.car.app.Screen;
import androidx.car.app.model.Action;
import androidx.car.app.model.ItemList;
import androidx.car.app.model.ListTemplate;
import androidx.car.app.model.OnClickListener;
import androidx.car.app.model.Row;
import androidx.car.app.model.Template;
import org.json.JSONArray;
import org.json.JSONObject;

/** Liste im Auto: heutige Aufträge, Lagerhalle und Verwaltung – antippen startet die Navigation auf dem Handy */
final class AutoAuftraege extends Screen {
    AutoAuftraege(CarContext c) {
        super(c);
    }

    private static String text(JSONObject o, String k) {
        String s = o.optString(k, "");
        return s == null || "null".equals(s) ? "" : s.replace('\n', ' ').trim();
    }

    @Override
    public Template onGetTemplate() {
        final CarContext c = getCarContext();
        ItemList.Builder liste = new ItemList.Builder();
        JSONObject a = AutoDaten.json(c, "auftraege");
        int n = 0;
        if (a != null) {
            JSONArray l = a.optJSONArray("liste");
            for (int i = 0; l != null && i < l.length() && n < 20; i++) {
                JSONObject o = l.optJSONObject(i);
                if (o == null) continue;
                final String id = text(o, "id"), adresse = text(o, "adresse");
                if (id.length() == 0 || adresse.length() == 0) continue;
                String titel = text(o, "kunde");
                if (titel.length() == 0) titel = adresse;
                String zeit = text(o, "ankunft_geplant");
                Row.Builder r = new Row.Builder().setTitle(titel).addText((zeit.length() > 0 ? zeit + " · " : "") + adresse)
                        .setOnClickListener(new OnClickListener() {
                            @Override
                            public void onClick() {
                                AutoDaten.auftragBefehl(c, id);
                                AutoDaten.toast(c, "Route wird berechnet …");
                                getScreenManager().pop();
                            }
                        });
                liste.addItem(r.build());
                n++;
            }
            JSONObject z = a.optJSONObject("ziele");
            String[] feste = {"lagerhalle", "verwaltung"};
            for (String k : feste) {
                JSONObject o = z == null ? null : z.optJSONObject(k);
                if (o == null) continue;
                final String adresse = text(o, "adresse");
                final String name = text(o, "name").length() > 0 ? text(o, "name") : k;
                if (adresse.length() == 0) continue;
                liste.addItem(new Row.Builder().setTitle(name).addText(adresse).setOnClickListener(new OnClickListener() {
                    @Override
                    public void onClick() {
                        AutoDaten.zielBefehl(c, name, adresse);
                        AutoDaten.toast(c, "Route wird berechnet …");
                        getScreenManager().pop();
                    }
                }).build());
                n++;
            }
        }
        if (n == 0) liste.setNoItemsMessage(AutoDaten.handyLaeuft(c) ? "Heute keine Aufträge." : "Bitte die Navi auf dem Handy öffnen.");
        return new ListTemplate.Builder().setTitle("Aufträge").setHeaderAction(Action.BACK).setSingleList(liste.build()).build();
    }
}
