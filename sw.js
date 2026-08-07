/* Pups Sideline Log — offline shell.
   Bump CACHE when a new version ships; the old cache is deleted on activate. */
var CACHE = "pups-sideline-v9";
var ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-180.png",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install", function(e){
  e.waitUntil(
    caches.open(CACHE).then(function(c){
      return c.addAll(ASSETS);
    }).then(function(){ return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.map(function(k){
        if(k !== CACHE) return caches.delete(k);
      }));
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function(e){
  var req = e.request;
  if(req.method !== "GET") return;

  /* The page itself: try the network so a new version lands as soon as
     there is signal, but fall back to cache the moment there isn't. */
  if(req.mode === "navigate"){
    e.respondWith(
      fetch(req).then(function(res){
        var copy = res.clone();
        caches.open(CACHE).then(function(c){ c.put("./index.html", copy); });
        return res;
      }).catch(function(){
        return caches.match("./index.html").then(function(m){
          return m || caches.match("./");
        });
      })
    );
    return;
  }

  /* setup.json changes weekly — always try the network, keep a copy for the field. */
  if(req.url.indexOf("setup.json") > -1){
    e.respondWith(
      fetch(req).then(function(res){
        if(res && res.ok){
          var copy = res.clone();
          caches.open(CACHE).then(function(c){ c.put("./setup.json", copy); });
        }
        return res;
      }).catch(function(){
        return caches.match("./setup.json").then(function(m){
          return m || new Response("{}", {status:404, headers:{"Content-Type":"application/json"}});
        });
      })
    );
    return;
  }

  /* Everything else (icons, manifest): cache first, it never changes mid-season. */
  e.respondWith(
    caches.match(req).then(function(m){
      return m || fetch(req).then(function(res){
        if(res && res.status === 200 && res.type === "basic"){
          var copy = res.clone();
          caches.open(CACHE).then(function(c){ c.put(req, copy); });
        }
        return res;
      }).catch(function(){ return m; });
    })
  );
});
