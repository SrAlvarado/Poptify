fn main() {
    // The screencapturekit crate ships Swift code whose build script only adds
    // the full-Xcode toolchain path for the Swift compatibility static libs
    // (libswiftCompatibility56.a etc.). With Command Line Tools only, that path
    // doesn't exist and linking fails — add whichever layout is present.
    #[cfg(target_os = "macos")]
    {
        let dev_dir = std::process::Command::new("xcode-select")
            .arg("-p")
            .output()
            .ok()
            .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
            .unwrap_or_default();
        for path in [
            format!("{dev_dir}/usr/lib/swift/macosx"), // Command Line Tools
            format!("{dev_dir}/Toolchains/XcodeDefault.xctoolchain/usr/lib/swift/macosx"), // Xcode
        ] {
            if std::path::Path::new(&path).exists() {
                println!("cargo:rustc-link-search=native={path}");
            }
        }
        // the Swift runtime (libswift_Concurrency & co.) lives in the dyld cache
        // under /usr/lib/swift; without this rpath the binary fails to launch
        println!("cargo:rustc-link-arg=-Wl,-rpath,/usr/lib/swift");
    }
    tauri_build::build()
}
