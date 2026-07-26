const CACHE_NAME = 'crenn-stock-v2'; // เปลี่ยนเป็น v2 เพื่อสั่งล้างไฟล์เก่าที่ค้างอยู่ในเครื่องผู้ใช้

self.addEventListener('install', (event) => {
  // บังคับให้ Service Worker ตัวใหม่เข้าควบคุมทันที ไม่ต้องรอปิดแอปแล้วเปิดใหม่
  self.skipWaiting(); 
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('Service Worker: Clearing Old Cache');
            return caches.delete(cache); // ลบไฟล์จากเวอร์ชันเก่าทิ้งทั้งหมด
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', (event) => {
  // ใช้กลยุทธ์ Network First: พยายามดึงข้อมูลใหม่ล่าสุดจากอินเทอร์เน็ตก่อนเสมอ
  // ถ้าไม่มีเน็ต (Offline) ถึงจะไปดึงไฟล์จาก Cache มาแสดงผล
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
