use tauri::{AppHandle, Emitter};

#[derive(Clone, serde::Serialize)]
pub struct UnlockPayload {
    pub timestamp: u64,
}

pub fn start_lock_listener(app: AppHandle) {
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
    let ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();

    app.emit("screen-unlocked", UnlockPayload { timestamp: ts })
        .expect("Failed to emit screen-unlocked event");
}
