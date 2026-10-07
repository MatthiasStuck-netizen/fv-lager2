plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "de.fehnverleih.navi"
    compileSdk = 35

    defaultConfig {
        applicationId = "de.fehnverleih.navi"
        minSdk = 26
        targetSdk = 35
        versionCode = 310
        versionName = "3.1"
    }

    // Fester Schluessel, damit sich neue Versionen ueber die alte installieren lassen (Anmeldung bleibt erhalten).
    signingConfigs {
        create("fest") {
            storeFile = file("../schluessel/fehnverleih-navi.jks")
            storePassword = "fehnverleih-navi"
            keyAlias = "fvnavi"
            keyPassword = "fehnverleih-navi"
        }
    }
    buildTypes {
        debug { signingConfig = signingConfigs.getByName("fest") }
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("fest")
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    lint {
        abortOnError = false
        checkReleaseBuilds = false
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.activity:activity-ktx:1.9.3")
    implementation("androidx.webkit:webkit:1.11.0")
    // Android Auto (Car App Library)
    implementation("androidx.car.app:app:1.4.0")
    // QR-Scanner fuer den Mitarbeiter-Ausweis (ZXing, ohne Google-Dienste)
    implementation("com.journeyapps:zxing-android-embedded:4.3.0")
}
