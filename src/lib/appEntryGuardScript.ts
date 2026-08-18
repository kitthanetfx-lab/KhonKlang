/**
 * สคริปต์ blocking — รันก่อน React paint ในแอpp
 * ยังไม่ login + หน้าที่ต้อง auth → location.replace ไป /login ทันที (ไม่กระพริบ)
 */
export const APP_ENTRY_GUARD_SCRIPT = `
(function(){
  if(!/GlanghubApp/i.test(navigator.userAgent||''))return;
  var path=location.pathname;
  var full=path+location.search;
  function loginUrl(r){
    r=(r&&r.charAt(0)==='/')?r:'/';
    return '/login?returnTo='+encodeURIComponent(r);
  }
  function hasSession(){
    try{
      for(var i=0;i<localStorage.length;i++){
        var k=localStorage.key(i);
        if(k&&k.indexOf('-auth-token')!==-1){
          var d=JSON.parse(localStorage.getItem(k)||'null');
          if(d&&d.access_token){
            var exp=d.expires_at;
            if(!exp||exp*1000>Date.now()+5000)return true;
          }
        }
      }
    }catch(e){}
    return false;
  }
  if(/^\\/(login|privacy|terms)(\\/|$)/.test(path))return;
  if(/^\\/auth\\//.test(path)){
    if(document.cookie.indexOf('line_session_pending=')!==-1)return;
    if(location.hash&&location.hash.indexOf('access_token')!==-1)return;
    var m=location.search.match(/[?&]returnTo=([^&]+)/);
    location.replace(loginUrl(m?decodeURIComponent(m[1]):'/'));
    return;
  }
  if(!hasSession()) location.replace(loginUrl(full));
})();
`.trim();
