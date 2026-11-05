# RadioTEDU Reels Party

Grupların birer temsilciyle katıldığı, her Reel için 1–10 ortak puan verdiği etkinlik uygulaması. Katılımcı adresi **https://radiotedu.com/reels-party/**; moderatör **/reels-party/admin**, sahne **/reels-party/stage**. Reel bağlantıları katılımcılara açıktır. Moderatör mevcut beş Reel'i sıralayabilir, yenilerini ekleyebilir, seçebilir ve puanlamayı yönetebilir.

## Çalışma biçimi

- Her temsilci bir grup oluşturur; boş ad bırakılırsa `Grup 1`, `Grup 2`… atanır. Grup kimliği temsilcinin tarayıcısında saklanır; sayfa yenilenince korunur. Cihaz/tarayıcı verisi silinirse yeni grup açılır. Sistem gerçek dünyada aynı kişinin başka cihazla başka grup açmasını kesin olarak engellemez; moderatör yanlış oluşturulan grupları kaldırabilir.
- Her grup açık turda bir ortak 1–10 puan verir; oylama açıkken güncelleyebilir. Sonuçlar moderatör açana kadar katılımcıya ve sahneye gizlidir. Açıldığında grup puanları ve puan veren grupların ortalaması gösterilir. Yeni Reel seçimi yeni tur açar.
- `extension/` mevcut Instagram projeksiyon köprüsüdür. Eklenti seçili Instagram sekmesini moderatörün Reel'ine yönlendirir; geçiş **tam sayfa yükler**, Instagram'ın özgün dikey kaydırma animasyonu değildir. Ses otomatik açılmayı deneyebilir; tarayıcı/Instagram ve salon ses sistemi ayrıca sınanmalıdır. Reel'ler indirilmez.
- `/stage` QR kodu, sonuçları ve Instagram gömülü oynatıcısını gösterir. Bazı Reel'ler gömülü oynatmada açılmayabilir; bu durumda eklentiyle gerçek Instagram sekmesini kullanın. Eklentinin paneli de QR ve grup sonuçlarını gösterebilir.

## Sunucu: Docker Compose

Node.js 24.15+ veya Docker Compose, mevcut HTTPS alan adı ve mevcut web sunucusunda yalnızca alt yolu yönlendirme yetkisi gerekir. **Bu depo mevcut WordPress sitesinin yerine kurulmaz.**

1. Depoyu sunucuya çekin. `.env.example` dosyasını `.env` olarak kopyalayın; `ADMIN_PASSWORD` için en az 12 karakterlik benzersiz bir parola, `SESSION_SECRET` için en az 32 karakterlik ayrı rastgele bir sır üretin. `PUBLIC_URL=https://radiotedu.com/reels-party` bırakın. `.env` dosyasını gizli tutun; Git'e göndermeyin. Secret değişirse mevcut moderatör oturumları kapanır.
2. `docker compose up -d --build` çalıştırın. Uygulama yalnızca sunucunun `127.0.0.1:3100` adresine açılır; SQLite verisi `reels-party-data` adlı kalıcı volume'dedir. Konteyneri yeniden oluşturmak veriyi silmez; volume'u silmek siler.
3. **Mevcut** `radiotedu.com` HTTPS sanal sunucusuna `deploy/nginx-location.conf.example` içindeki iki location bloğunu uyarlayın. `proxy_pass` sonunda `/` olmamalıdır; `/reels-party/` yolu uygulamaya aynen iletilir. Nginx değilse mevcut ters vekilin eşdeğerini kullanın. Mevcut site, TLS ve diğer yollar korunmalıdır. Ayarı sınayın ve yalnızca başarılıysa web sunucusunu yeniden yükleyin.
4. `https://radiotedu.com/reels-party/api/state` ve `/reels-party/` adreslerini doğrulayın. Moderatörde `.env` içindeki parola ile giriş yapın. İki ayrı telefondan grup oluşturun, bir Reel için 8 ve 5 puan verin, sonuçları açıp ortalama 6,5'i kontrol edin. Test gruplarını moderatörde kaldırın; gerçek etkinlikte mevcut grupları ve puanları silmeyin.

Puanlar ve gruplar SQLite dosyasında tutulur. Tek uygulama örneği ve kalıcı yerel disk kullanın. Etkinlik öncesi ve sonrası `reels-party-data` volume'unun tutarlı bir yedeğini alın; veritabanını yedeklerken SQLite'ın yedekleme mekanizmasını kullanın veya uygulamayı kısa süre durdurun. `.env` ve yedekleri özel saklayın.

## Geliştirme / test

`npm ci` ve `npm test` çalıştırın. Yerel denemede `PUBLIC_URL=http://127.0.0.1:3107/reels-party`, `PORT=3107`, `ADMIN_PASSWORD` ve `SESSION_SECRET` ortam değişkenlerini ayarlayıp `npm start` çalıştırın. Üretimde açık HTTP URL kabul edilmez; HTTPS gereklidir. Gizli ayarlar ve veritabanı Git dışındadır.

## Instagram projeksiyon eklentisi

Projeksiyon bilgisayarında Chrome → Uzantılar → Geliştirici modu → **Paketlenmemiş öğe yükle** ile bu deponun `extension` klasörünü yükleyin. Instagram hesabınıza giriş yapın ve herhangi bir Reel açın. Eklentide **START · BU SEKMEYİ BAĞLA** düğmesine basın. İsteğe bağlı QR/sonuç ve otomatik ses seçeneklerini açın. Moderatörden Reel seçip doğru videoyu, başa dönme davranışını ve hoparlör sesini gerçek ortamda prova edin. Yayın adresi sabit olarak `https://radiotedu.com/reels-party` şeklindedir; farklı alan adı kullanılacaksa eklentideki `background.js` ve `manifest.json` birlikte uyarlanıp eklenti yeniden yüklenmelidir.

Önceki Cloudflare Sites denemesinin veritabanı bu sunucuya otomatik taşınmaz. Başlangıçta beş Reel URL'si ve görünür adı eklenir; gruplar ve puanlar yeni kurulumda boştur.
