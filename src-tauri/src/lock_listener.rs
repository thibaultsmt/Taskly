use tauri::{AppHandle, Emitter, Listener, Manager};

#[derive(Clone, serde::Serialize)]
pub struct UnlockPayload {
    pub timestamp: u64,
}

pub fn start_lock_listener(app: AppHandle) {
    #[cfg(target_os = "windows")]
    start_keyboard_hook(app.clone());

    #[cfg(target_os = "macos")]
    start_keyboard_hook_macos(app.clone());

    std::thread::spawn(move || {
        #[cfg(target_os = "windows")]
        windows_listener(app);

        #[cfg(target_os = "macos")]
        macos_listener(app);

        #[cfg(target_os = "linux")]
        linux_listener(app);

        #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
        loop {
            std::thread::sleep(std::time::Duration::from_secs(60));
        }
    });
}

#[cfg(target_os = "windows")]
fn windows_listener(app: AppHandle) {
    use windows::Win32::Foundation::HWND;
    use windows::Win32::System::RemoteDesktop::{
        WTSRegisterSessionNotification, NOTIFY_FOR_THIS_SESSION,
    };
    use windows::Win32::UI::WindowsAndMessaging::{
        CreateWindowExW, DefWindowProcW, DispatchMessageW, GetMessageW, RegisterClassW,
        TranslateMessage, CS_HREDRAW, CS_VREDRAW, MSG, WINDOW_EX_STYLE, WNDCLASSW,
        WM_WTSSESSION_CHANGE, WTS_SESSION_UNLOCK,
    };

    unsafe {
        let class_name: Vec<u16> = "TasklyLockListener\0".encode_utf16().collect();
        let wc = WNDCLASSW {
            style: CS_HREDRAW | CS_VREDRAW,
            lpfnWndProc: Some(DefWindowProcW),
            lpszClassName: windows::core::PCWSTR(class_name.as_ptr()),
            ..Default::default()
        };
        RegisterClassW(&wc);

        let hwnd = CreateWindowExW(
            WINDOW_EX_STYLE(0),
            windows::core::PCWSTR(class_name.as_ptr()),
            windows::core::PCWSTR::null(),
            windows::Win32::UI::WindowsAndMessaging::WINDOW_STYLE(0),
            0,
            0,
            0,
            0,
            HWND(-3isize),
            None,
            None,
            None,
        )
        .unwrap();

        WTSRegisterSessionNotification(hwnd, NOTIFY_FOR_THIS_SESSION).unwrap();

        let mut msg = MSG::default();
        while GetMessageW(&mut msg, None, 0, 0).into() {
            if msg.message == WM_WTSSESSION_CHANGE {
                if msg.wParam.0 as u32 == WTS_SESSION_UNLOCK {
                    emit_unlock(&app);
                }
            }
            let _ = TranslateMessage(&msg);
            DispatchMessageW(&msg);
        }
    }
}

#[cfg(target_os = "macos")]
fn macos_listener(app: AppHandle) {
    use core_foundation_sys::base::CFRelease;
    use core_foundation_sys::notification_center::{
        CFNotificationCenterAddObserver, CFNotificationCenterGetDistributedCenter,
        CFNotificationCenterRef, CFNotificationSuspensionBehaviorDeliverImmediately,
    };
    use core_foundation_sys::runloop::CFRunLoopRun;
    use core_foundation_sys::string::{
        kCFStringEncodingUTF8, CFStringCreateWithBytes, CFStringRef,
    };
    use std::ffi::c_void;

    extern "C" fn on_screen_unlocked(
        _center: CFNotificationCenterRef,
        observer: *mut c_void,
        _name: CFStringRef,
        _object: *const c_void,
        _user_info: core_foundation_sys::dictionary::CFDictionaryRef,
    ) {
        if !observer.is_null() {
            unsafe {
                let app = &*(observer as *const AppHandle);
                emit_unlock(app);
            }
        }
    }

    let app_ptr = Box::into_raw(Box::new(app)) as *mut c_void;

    unsafe {
        let center = CFNotificationCenterGetDistributedCenter();

        let notification_name = b"com.apple.screenIsUnlocked";
        let name_ref = CFStringCreateWithBytes(
            std::ptr::null_mut(),
            notification_name.as_ptr(),
            notification_name.len() as _,
            kCFStringEncodingUTF8,
            0,
        );

        CFNotificationCenterAddObserver(
            center,
            app_ptr,
            on_screen_unlocked,
            name_ref,
            std::ptr::null(),
            CFNotificationSuspensionBehaviorDeliverImmediately,
        );

        CFRelease(name_ref as _);

        CFRunLoopRun();
    }
}

#[cfg(target_os = "linux")]
fn linux_listener(app: AppHandle) {
    use dbus::blocking::Connection;
    use std::time::Duration;

    let conn = Connection::new_system().expect("D-Bus connection failed");
    let proxy = conn.with_proxy(
        "org.freedesktop.login1",
        "/org/freedesktop/login1/session/auto",
        Duration::from_millis(5000),
    );

    use dbus::blocking::stdintf::org_freedesktop_dbus::PropertiesPropertiesChanged;
    let _ = proxy.match_signal(
        |_: PropertiesPropertiesChanged, _: &Connection, _: &dbus::Message| {
            emit_unlock(&app);
            true
        },
    );

    loop {
        conn.process(Duration::from_millis(1000)).unwrap();
    }
}

fn emit_unlock(app: &AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.show();
        let _ = win.set_focus();
    }

    let ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();

    app.emit("screen-unlocked", UnlockPayload { timestamp: ts })
        .expect("Failed to emit screen-unlocked event");
}

#[cfg(target_os = "macos")]
fn emit_pre_lock(app: &AppHandle) {
    let ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();

    let _ = app.emit("pre-lock", UnlockPayload { timestamp: ts });
}

#[cfg(target_os = "windows")]
static KB_HOOK_APP: std::sync::OnceLock<AppHandle> = std::sync::OnceLock::new();

#[cfg(target_os = "windows")]
pub fn start_keyboard_hook(app: AppHandle) {
    use windows::Win32::Foundation::LPARAM;
    use windows::Win32::Foundation::WPARAM;
    use windows::Win32::UI::Input::KeyboardAndMouse::{
        GetAsyncKeyState, VK_L, VK_LWIN, VK_RWIN,
    };
    use windows::Win32::UI::WindowsAndMessaging::{
        CallNextHookEx, SetWindowsHookExW, UnhookWindowsHookEx, HC_ACTION,
        KBDLLHOOKSTRUCT, WH_KEYBOARD_LL,
    };
    use windows::Win32::System::LibraryLoader::GetModuleHandleW;

    let _ = KB_HOOK_APP.set(app.clone());

    std::thread::spawn(move || {
        unsafe extern "system" fn low_level_keyboard_proc(
            n_code: i32,
            w_param: WPARAM,
            l_param: LPARAM,
        ) -> windows::Win32::Foundation::LRESULT {
            use windows::Win32::UI::Input::KeyboardAndMouse::{
                GetAsyncKeyState, VK_L, VK_LWIN, VK_RWIN,
            };
            use windows::Win32::UI::WindowsAndMessaging::{
                CallNextHookEx, KBDLLHOOKSTRUCT, HC_ACTION,
            };

            if n_code as u32 == HC_ACTION && w_param.0 as u32 == 0x0100 /* WM_KEYDOWN */ {
                let kb = &*(l_param.0 as *const KBDLLHOOKSTRUCT);
                let is_l_key = kb.vkCode == VK_L.0 as u32;
                let win_pressed = GetAsyncKeyState(VK_LWIN.0 as i32) as u16 & 0x8000 != 0
                    || GetAsyncKeyState(VK_RWIN.0 as i32) as u16 & 0x8000 != 0;

                if is_l_key && win_pressed {
                    if let Some(app) = KB_HOOK_APP.get() {
                        let ts = std::time::SystemTime::now()
                            .duration_since(std::time::UNIX_EPOCH)
                            .unwrap()
                            .as_secs();
                        let _ = app.emit("pre-lock", UnlockPayload { timestamp: ts });
                    }
                    return windows::Win32::Foundation::LRESULT(1);
                }
            }

            CallNextHookEx(None, n_code, w_param, l_param)
        }

        unsafe {
            let h_module = GetModuleHandleW(None).unwrap_or_default();
            let hook = SetWindowsHookExW(WH_KEYBOARD_LL, Some(low_level_keyboard_proc), h_module, 0)
                .expect("Failed to set keyboard hook");

            use windows::Win32::UI::WindowsAndMessaging::LockWorkStation;
            app.listen("confirm-lock", move |_| {
                let _ = LockWorkStation();
            });

            use windows::Win32::UI::WindowsAndMessaging::{GetMessageW, DispatchMessageW, TranslateMessage, MSG};
            let mut msg = MSG::default();
            while GetMessageW(&mut msg, None, 0, 0).into() {
                let _ = TranslateMessage(&msg);
                DispatchMessageW(&msg);
            }

            UnhookWindowsHookEx(hook).ok();
        }
    });
}


#[cfg(target_os = "macos")]
static KB_HOOK_APP_MAC: std::sync::OnceLock<AppHandle> = std::sync::OnceLock::new();

#[cfg(target_os = "macos")]
fn request_accessibility_if_needed() {
    use core_foundation_sys::base::{kCFAllocatorDefault, CFRelease, CFTypeRef};
    use core_foundation_sys::dictionary::{
        CFDictionaryCreate, kCFTypeDictionaryKeyCallBacks, kCFTypeDictionaryValueCallBacks,
    };
    use core_foundation_sys::string::CFStringRef;
    use std::ffi::c_void;

    #[link(name = "CoreFoundation", kind = "framework")]
    extern "C" {
        static kCFBooleanTrue: *const c_void;
    }

    #[link(name = "ApplicationServices", kind = "framework")]
    extern "C" {
        static kAXTrustedCheckOptionPrompt: CFStringRef;
        fn AXIsProcessTrustedWithOptions(options: *const c_void) -> bool;
    }

    unsafe {
        if AXIsProcessTrustedWithOptions(std::ptr::null()) {
            return;
        }
        let keys: [*const c_void; 1] = [kAXTrustedCheckOptionPrompt as *const c_void];
        let values: [*const c_void; 1] = [kCFBooleanTrue as *const c_void];
        let dict = CFDictionaryCreate(
            kCFAllocatorDefault as _,
            keys.as_ptr() as _,
            values.as_ptr() as _,
            1,
            &kCFTypeDictionaryKeyCallBacks,
            &kCFTypeDictionaryValueCallBacks,
        );
        AXIsProcessTrustedWithOptions(dict as _);
        CFRelease(dict as CFTypeRef);
    }
}

#[cfg(target_os = "macos")]
pub fn start_keyboard_hook_macos(app: AppHandle) {
    request_accessibility_if_needed();

    use std::ffi::c_void;

    extern "C" {
        fn CGEventTapCreate(
            tap: u32,
            place: u32,
            options: u32,
            events_of_interest: u64,
            callback: unsafe extern "C" fn(
                proxy: *mut c_void,
                event_type: u32,
                event: *mut c_void,
                user_info: *mut c_void,
            ) -> *mut c_void,
            user_info: *mut c_void,
        ) -> *mut c_void;
        fn CFMachPortCreateRunLoopSource(
            alloc: *const c_void, port: *mut c_void, order: isize,
        ) -> *mut c_void;
        fn CFRunLoopGetCurrent() -> *mut c_void;
        fn CFRunLoopAddSource(rl: *mut c_void, source: *mut c_void, mode: *const c_void);
        fn CFRunLoopRun();
        fn CGEventGetFlags(event: *mut c_void) -> u64;
        fn CGEventGetIntegerValueField(event: *mut c_void, field: i32) -> i64;
    }

    let _ = KB_HOOK_APP_MAC.set(app.clone());

    app.listen("confirm-lock", move |_| {
        let _ = std::process::Command::new(
            "/System/Library/CoreServices/Menu Extras/User.menu/Contents/Resources/CGSession",
        )
        .arg("-suspend")
        .spawn();
    });

    std::thread::spawn(move || {
        unsafe extern "C" fn event_callback(
            _proxy: *mut c_void,
            event_type: u32,
            event: *mut c_void,
            _user_info: *mut c_void,
        ) -> *mut c_void {
            if event_type == 10 /* kCGEventKeyDown */ {
                let key_code = CGEventGetIntegerValueField(event, 9);
                let flags = CGEventGetFlags(event);
                let cmd = 0x100000u64;
                let ctrl = 0x40000u64;
                if key_code == 12 && (flags & cmd != 0) && (flags & ctrl != 0) {
                    if let Some(app) = KB_HOOK_APP_MAC.get() {
                        emit_pre_lock(app);
                    }
                    return std::ptr::null_mut();
                }
            }
            event
        }

        let event_mask: u64 = 1 << 10;

        let tap = loop {
            let t = unsafe {
                CGEventTapCreate(
                    0,
                    0,
                    0,
                    event_mask,
                    event_callback,
                    std::ptr::null_mut(),
                )
            };
            if !t.is_null() {
                break t;
            }
            std::thread::sleep(std::time::Duration::from_secs(3));
        };

        unsafe {
            use core_foundation_sys::runloop::kCFRunLoopCommonModes;
            let source = CFMachPortCreateRunLoopSource(std::ptr::null(), tap, 0);
            let rl = CFRunLoopGetCurrent();
            CFRunLoopAddSource(rl, source, kCFRunLoopCommonModes as *const c_void);
            CFRunLoopRun();
        }
    });
}
