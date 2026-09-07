# PHÁT TRỰC TIẾP ĐA LUỒNG

Desktop app Windows để phát nhiều video đồng thời tới YouTube Live qua RTMP bằng FFmpeg.

## Core
- Electron + React + TypeScript + Vite
- Một FFmpeg process cho mỗi stream
- RTMP cố định: `rtmp://a.rtmp.youtube.com/live2`
- 16:9 = 1920x1080
- 9:16 = 1080x1920
- Loop vô hạn bằng `-stream_loop -1`
- H.264 + AAC + FLV
- Start/Stop từng stream và toàn bộ
- Auto reconnect
- Video picker + ffprobe metadata
- CPU/RAM monitor
- Windows installer bằng electron-builder

## Chạy development
```bash
npm install
npm run dev
```

## Build
```bash
npm run build
```

## Đóng gói Windows
Đặt `ffmpeg.exe` và `ffprobe.exe` vào `resources/ffmpeg/`, sau đó:
```bash
npm run package
```

Installer sẽ nằm trong `release/`.

## YouTube
Người dùng cần tự tạo/quản lý livestream và Stream Key trên YouTube. Ứng dụng chỉ gửi dữ liệu video qua RTMP và không bypass giới hạn hay chính sách của YouTube.

## FFmpeg
Khi phân phối binary FFmpeg, hãy kiểm tra và tuân thủ license của binary/build mà bạn sử dụng.

## Trạng thái foundation
Bản 0.1 đã có skeleton chạy được cho UI, IPC, FFmpeg process manager, RTMP command builder, video picker/probe, multi-stream lifecycle và installer configuration. Trước khi phát hành production cần hoàn thiện persistence của Stream Key bằng Windows Credential Manager, History database, preview, tray icon production và kiểm thử thực tế với tài khoản YouTube.
