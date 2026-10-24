package de.fehnverleih.navi;

import androidx.car.app.CarAppService;
import androidx.car.app.Session;
import androidx.car.app.validation.HostValidator;

/** Android Auto: Einstieg. Die Navi erscheint im Auto als Navigations-App mit eigener Karte. */
public final class AutoDienst extends CarAppService {
    @Override
    public HostValidator createHostValidator() {
        return HostValidator.ALLOW_ALL_HOSTS_VALIDATOR;
    }

    @Override
    public Session onCreateSession() {
        return new AutoSitzung();
    }
}
