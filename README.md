# ✦ Gemi — Kozmik Fantezi İdle/Strateji Oyunu

Pannable harita üzerinde köyler kurup, ordu eğitip, Güneş Tozu toplayan cosmic-fantasy temalı tarayıcı oyunu.

## 🎮 Oyna

Oyun tamamen tarayıcıda çalışır — kurulum gerekmez.
**[Buradan oyna →](https://KULLANICI-ADIN.github.io/gemi/)**

## ✨ Özellikler

- **Pannable harita** — köyler, yollar, dekoratif çevre
- **5 köy** — Pilag (ticaret), Raw (ordu), Nasi (keşif), Zaman Tapınağı (XP/prestige), Tarım Köyü (kaynak)
- **Ordu sistemi** — asker eğitimi, ekipman yükseltmeleri, birikintilere sefer
- **Farm sistemi** — odun/taş/metal toplama ve yükseltmeler
- **Boss savaşları** — periyodik canavarlar, otomatik savaş
- **Görev sistemi** — günlük/haftalık hedefler, ödüller
- **Prestige** — Zamanın Tutulması ile sıfırlama
- **Online** — Google/misafir giriş, bulut kayıt, gerçek global sohbet, çevrimiçi oyuncu sayısı
- **Ses** — prosedürel Web Audio efektleri + ambient müzik

## 🛠️ Teknoloji

- Saf ES Modülleri (framework yok)
- CSS transform tabanlı harita navigasyonu
- Web Audio API ile sentezlenmiş ses
- Firebase (Auth + Firestore) — bulut kayıt, sohbet, sıralama

## 📁 Yapı

```
index.html        — layout + modaller
style.css         — tema ve tüm stiller
js/
  core.js         — ana oyun döngüsü ve durum
  map.js          — harita, köyler, sefer animasyonları
  producers.js    — köy tanımları
  farm.js         — kaynak toplama sistemi
  boss.js         — boss sistemi
  quests.js       — günlük/haftalık görevler
  audio.js        — prosedürel ses
  cloud.js        — Firebase entegrasyonu
  kingdom.js      — krallık kimliği, sohbet, sıralama
  ...
assets/           — köy, birim, boss ve harita görselleri
```

## 🔧 Yerel Çalıştırma

ES Modülleri kullandığı için bir HTTP sunucusu gerekir (dosyayı direkt açmak çalışmaz):

```bash
# VS Code Live Server eklentisi, veya:
python3 -m http.server 8000
# → http://localhost:8000
```
