(function(){
  'use strict';
  var $=function(s,c){return (c||document).querySelector(s)};
  var $$=function(s,c){return Array.prototype.slice.call((c||document).querySelectorAll(s))};
  var reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* header, progress bar, back to top, hero parallax */
  var header=$('.site-header'),bar=$('#progress'),top=$('.to-top'),heroImg=$('.hero-bg img');
  function onScroll(){
    var y=window.scrollY,h=document.documentElement.scrollHeight-window.innerHeight;
    if(header)header.classList.toggle('scrolled',y>30);
    if(bar)bar.style.width=(h>0?y/h*100:0)+'%';
    if(top)top.classList.toggle('show',y>700);
    if(heroImg&&!reduce&&y<window.innerHeight*1.2)heroImg.style.transform='translate3d(0,'+(y*.22)+'px,0) scale(1.08)';
  }
  window.addEventListener('scroll',onScroll,{passive:true});onScroll();
  if(top)top.addEventListener('click',function(){window.scrollTo({top:0,behavior:'smooth'})});

  /* mobile menu (dropdown card under the pill header) */
  var burger=$('.burger'),menu=$('.menu');
  function closeMenu(){if(!menu)return;menu.classList.remove('open');burger.classList.remove('open');burger.setAttribute('aria-expanded','false')}
  if(burger){
    burger.addEventListener('click',function(e){
      e.stopPropagation();
      var o=menu.classList.toggle('open');burger.classList.toggle('open',o);burger.setAttribute('aria-expanded',o);
    });
    $$('.menu a').forEach(function(a){a.addEventListener('click',closeMenu)});
    document.addEventListener('click',function(e){if(!e.target.closest('.nav'))closeMenu()});
    document.addEventListener('keydown',function(e){if(e.key==='Escape')closeMenu()});
    window.addEventListener('resize',function(){if(window.innerWidth>860)closeMenu()});
  }

  /* split hero heading into words for the load animation */
  $$('.hero h1').forEach(function(h){
    var i=0;
    (function walk(node){
      Array.prototype.slice.call(node.childNodes).forEach(function(n){
        if(n.nodeType===3){
          var f=document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(function(t){
            if(!t)return;
            if(/^\s+$/.test(t)){f.appendChild(document.createTextNode(' '));return}
            var w=document.createElement('span');w.className='w';
            var s=document.createElement('span');s.textContent=t;s.style.setProperty('--i',i++);
            w.appendChild(s);f.appendChild(w);
          });
          n.parentNode.replaceChild(f,n);
        }else if(n.nodeType===1){walk(n)}
      });
    })(h);
  });

  /* reveal on scroll */
  var io=new IntersectionObserver(function(es){
    es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}});
  },{threshold:.14,rootMargin:'0px 0px -6% 0px'});
  $$('.rv,.reveal-img').forEach(function(el){io.observe(el)});

  /* counters */
  var co=new IntersectionObserver(function(es){
    es.forEach(function(e){
      if(!e.isIntersecting)return;co.unobserve(e.target);
      var el=e.target,to=parseFloat(el.dataset.to),suf=el.dataset.suf||'',dec=(el.dataset.to.split('.')[1]||'').length;
      if(reduce){el.textContent=to.toFixed(dec)+suf;return}
      var t0=performance.now(),d=1800;
      (function tick(t){
        var p=Math.min((t-t0)/d,1),v=to*(1-Math.pow(1-p,4));
        el.textContent=v.toFixed(dec)+suf;if(p<1)requestAnimationFrame(tick);
      })(t0);
    });
  },{threshold:.6});
  $$('[data-to]').forEach(function(el){co.observe(el)});

  /* tabs */
  $$('[data-tabs]').forEach(function(box){
    var btns=$$('.tabs button',box),panes=$$('.pane',box);
    btns.forEach(function(b,i){b.addEventListener('click',function(){
      btns.forEach(function(x){x.classList.remove('on');x.setAttribute('aria-selected','false')});
      panes.forEach(function(x){x.classList.remove('on')});
      b.classList.add('on');b.setAttribute('aria-selected','true');panes[i].classList.add('on');
    })});
  });

  /* FAQ accordion */
  $$('.qa button').forEach(function(b){
    b.setAttribute('aria-expanded','false');
    b.addEventListener('click',function(){
      var q=b.parentNode,open=q.classList.toggle('open');b.setAttribute('aria-expanded',open);
    });
  });

  /* testimonial sliders */
  $$('.slider').forEach(function(s){
    var sl=$$('.slide',s),dots=$('.dots',s),cur=0,timer;
    sl.forEach(function(_,i){
      var d=document.createElement('button');d.setAttribute('aria-label','Show testimonial '+(i+1));
      d.addEventListener('click',function(){go(i);restart()});dots.appendChild(d);
    });
    function go(i){
      cur=i;sl.forEach(function(x,n){x.classList.toggle('on',n===i)});
      $$('button',dots).forEach(function(x,n){x.classList.toggle('on',n===i)});
    }
    function restart(){clearInterval(timer);if(!reduce)timer=setInterval(function(){go((cur+1)%sl.length)},6000)}
    go(0);restart();
  });

  /* portfolio filters */
  var fbar=$('.filters');
  if(fbar){
    $$('button',fbar).forEach(function(b){b.addEventListener('click',function(){
      $$('button',fbar).forEach(function(x){x.classList.remove('on')});b.classList.add('on');
      var f=b.dataset.f;
      $$('.work').forEach(function(w){w.classList.toggle('hide',f!=='all'&&w.dataset.cat!==f)});
    })});
  }

  /* card glow follows the pointer */
  $$('.card').forEach(function(c){
    c.addEventListener('pointermove',function(e){
      var r=c.getBoundingClientRect();
      c.style.setProperty('--mx',(e.clientX-r.left)+'px');c.style.setProperty('--my',(e.clientY-r.top)+'px');
    });
  });

  /* tilt on work cards (fine pointers only) */
  if(!reduce&&window.matchMedia('(hover:hover)').matches){
    $$('.work').forEach(function(w){
      w.addEventListener('pointermove',function(e){
        var r=w.getBoundingClientRect(),x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;
        w.style.transform='perspective(900px) rotateY('+(x*8)+'deg) rotateX('+(-y*8)+'deg) translateY(-6px)';
      });
      w.addEventListener('pointerleave',function(){w.style.transform=''});
    });
    /* magnetic primary buttons */
    $$('.btn-gold').forEach(function(b){
      b.addEventListener('pointermove',function(e){
        var r=b.getBoundingClientRect();
        b.style.transform='translate('+((e.clientX-r.left-r.width/2)*.18)+'px,'+((e.clientY-r.top-r.height/2)*.28)+'px)';
      });
      b.addEventListener('pointerleave',function(){b.style.transform=''});
    });
  }

  /* demo form handling — wire these to your backend or form service */
  $$('form[data-demo]').forEach(function(f){
    f.addEventListener('submit',function(e){
      e.preventDefault();var ok=$('.ok',f);if(ok)ok.classList.add('show');f.reset();
    });
  });

  var y=$('#yr');if(y)y.textContent=new Date().getFullYear();
})();