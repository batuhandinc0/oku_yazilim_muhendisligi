# Alışkanlık Takip Uygulaması (--AlışkanlıkPlus--)

Node.js, Express ve MySQL kullanılarak geliştirilmiş, oyunlaştırma (gamification) özelliklerine sahip web tabanlı bir alışkanlık takip uygulaması.

---

## 🚀 Özellikler

### 👤 Kullanıcı Yönetimi

* Kullanıcı kaydı (kullanıcı adı, e-posta, şifre)
* Giriş/çıkış işlemleri
* JWT tabanlı kimlik doğrulama

### 📅 Alışkanlık Yönetimi

* Alışkanlık oluşturma, görüntüleme, güncelleme ve silme
* Alışkanlıkları **isim**, **kategori** ve **sıklık** (günlük/haftalık) olarak takip etme
* Alışkanlıkları “tamamlandı” olarak işaretleme

### 🏆 Oyunlaştırma (Gamification)

* **Puan sistemi**: Her tamamlanan alışkanlık = 1 puan
* **Seviye sistemi**: Her 10 puanda bir seviye atlanır
* **Rozetler** (başarı simgeleri):

  * 🕖 *“Seri Katılım”*: 7 gün üst üste alışkanlık tamamlama
  * 💪 *“İstikrar Ustası”*: 30 puana ulaşma

### 📊 Takip ve Görselleştirme

* Takvim görünümüyle tamamlanan alışkanlıkları görüntüleme
* İstatistiklerle ilerleme takibi
* Kazanılan rozetlerin görüntülenmesi

---

## 🧱 Teknoloji Yığını (Tech Stack)

* **Backend**: Node.js + Express.js
* **Veritabanı**: MySQL
* **Frontend**: HTML, CSS, Vanilla JavaScript
* **Kimlik Doğrulama**: JWT (JSON Web Tokens)
* **Şifre Güvenliği**: bcryptjs 

---