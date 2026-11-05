# Reels Party uygulama planı

- `server/`: Node.js ve SQLite ile `/reels-party/` altında çalışan, kalıcı grup, Reel ve tur verileri sağlayan sunucu. Moderatör parola oturumu, başlangıç havuzu ve yanlış tur puanlarını reddetme.
- `public/`: RadioTEDU stilinde temsilci katılımı, 1–10 grup puanı, sonuçlar, moderatör havuzu ve projeksiyon ekranı. Reel bağlantıları korunur.
- `extension/`: mevcut Instagram köprüsü; yeni adres ve QR/sonuç verileriyle uyumlu.
- `tests/`: ayrı grupların oluşturulması, kimlik ve yetki denetimi, aynı grup için tek puan, tur geçişi, alt yol, ortalama, yeniden başlatmada kalıcılık ve eklenti bağlantısı.
- `Dockerfile`, `compose.yaml`, `.env.example`, `README.md`: geri dönüşümlü kurulum ve mevcut WordPress sunucusu önünde yalnızca `/reels-party/` ters vekil örneği.
- Canlı RadioTEDU görsel referansı ve mobil/masaüstü görünümü kontrol edilecek. Ardından `trivagotr` altında özel GitHub deposuna gönderilecek. Gerçek Instagram sesi ve sunucu devri bağımsız biçimde doğrulanmadan başarılı iddia edilmeyecek.
