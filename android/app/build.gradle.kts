plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.poptify.app"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.poptify.app"
        minSdk = 27
        targetSdk = 34
        versionCode = 1
        versionName = "0.1.0"

        // Spotify Client ID — same app as desktop. Add poptify://callback as a
        // Redirect URI in the Spotify dashboard.
        manifestPlaceholders["spotifyClientId"] = "a99ea3753fc742cdbafaddae01028015"
        buildConfigField("String", "SPOTIFY_CLIENT_ID", "\"a99ea3753fc742cdbafaddae01028015\"")
        buildConfigField("String", "REDIRECT_URI", "\"poptify://callback\"")
    }

    buildTypes {
        debug { isMinifyEnabled = false }
        release { isMinifyEnabled = false }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
    buildFeatures { buildConfig = true }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.4")
    implementation("androidx.browser:browser:1.8.0")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("androidx.palette:palette-ktx:1.0.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")
}
