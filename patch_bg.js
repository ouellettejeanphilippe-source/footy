const fs = require('fs');

let content = fs.readFileSync('index.html', 'utf8');

// Replace document.body references in applyBgStyle with an app-bg-container
// Also ensure app-bg-container exists and we target it
content = content.replace(/function applyBgStyle\(\) \{[\s\S]*?\}\n\}/, `function applyBgStyle() {
  var s = userPrefs.bgStyle || 'gradient';
  var c1 = userPrefs.c1 || '#000000';
  var c2 = userPrefs.c2 || '#111111';
  var c3 = userPrefs.c3 || '#222222';
  var blurVal = userPrefs.bgBlur || 0;
  var darkenVal = userPrefs.bgDarken || 0;

  document.documentElement.style.setProperty('--bg', c1);

  // Use a dedicated background container
  var appBg = document.getElementById('app-bg-container');
  if(!appBg) {
      appBg = document.createElement('div');
      appBg.id = 'app-bg-container';
      appBg.style.position = 'fixed';
      appBg.style.top = '0';
      appBg.style.left = '0';
      appBg.style.width = '100vw';
      appBg.style.height = '100vh';
      appBg.style.zIndex = '-3';
      appBg.style.pointerEvents = 'none';
      document.body.appendChild(appBg);
  }

  // Clear body background styles to avoid interference
  document.body.style.background = 'transparent';
  document.body.style.backgroundColor = 'transparent';

  appBg.style.backgroundColor = '';
  appBg.style.backgroundBlendMode = '';
  appBg.classList.remove('bg-animated-gradient', 'bg-animated-aurora', 'bg-moving-glows');

  var existingShapes = document.getElementById('floating-shapes-container');
  if(existingShapes) existingShapes.style.display = 'none';
  var existingWaves = document.getElementById('animated-waves-container');
  if(existingWaves) existingWaves.style.display = 'none';

  // Handle Blur and Darken via a dynamic pseudo-element or overlay
  var bgModifier = document.getElementById('bg-modifier-overlay');
  if(!bgModifier) {
      bgModifier = document.createElement('div');
      bgModifier.id = 'bg-modifier-overlay';
      bgModifier.style.position = 'fixed';
      bgModifier.style.top = '0';
      bgModifier.style.left = '0';
      bgModifier.style.width = '100vw';
      bgModifier.style.height = '100vh';
      bgModifier.style.pointerEvents = 'none';
      bgModifier.style.zIndex = '-1'; // just above the app-bg-container and behind content
      document.body.appendChild(bgModifier);
  }

  bgModifier.style.backdropFilter = blurVal > 0 ? 'blur(' + (blurVal / 5) + 'px)' : 'none';
  bgModifier.style.webkitBackdropFilter = blurVal > 0 ? 'blur(' + (blurVal / 5) + 'px)' : 'none';
  bgModifier.style.backgroundColor = darkenVal > 0 ? 'rgba(0, 0, 0, ' + (darkenVal / 100) + ')' : 'transparent';

  if (s === 'solid') {
    appBg.style.background = c1;
  } else if (s === 'linear') {
    appBg.style.background = 'linear-gradient(135deg, ' + c1 + ' 0%, ' + c2 + ' 50%, ' + c3 + ' 100%)';
  } else if (s === 'radial') {
    appBg.style.background = 'radial-gradient(circle at center, ' + c2 + ' 0%, ' + c3 + ' 50%, ' + c1 + ' 100%)';
  } else if (s === 'blur') {
    appBg.style.background = '#000 radial-gradient(circle at 20% 30%, '+c1+'80 0%, transparent 40%), radial-gradient(circle at 80% 80%, '+c2+'80 0%, transparent 40%), radial-gradient(circle at 50% 50%, '+c3+'60 0%, transparent 50%)';
  } else if (s === 'waves') {
    appBg.style.background = 'repeating-radial-gradient(ellipse at bottom, '+c1+' 0%, '+c2+' 10%, '+c3+' 20%)';
  } else if (s === 'mesh') {
    appBg.style.background = 'radial-gradient(at 0% 0%, '+c1+' 0, transparent 50%), radial-gradient(at 100% 0%, '+c2+' 0, transparent 50%), radial-gradient(at 100% 100%, '+c3+' 0, transparent 50%), radial-gradient(at 0% 100%, '+c1+' 0, transparent 50%)';
    appBg.style.backgroundColor = '#000';
  } else if (s === 'mesh_flou_1') {
    appBg.style.background = 'radial-gradient(at 20% 20%, '+c1+' 0, transparent 40%), radial-gradient(at 80% 10%, '+c2+' 0, transparent 40%), radial-gradient(at 90% 80%, '+c3+' 0, transparent 50%), radial-gradient(at 10% 90%, '+c1+' 0, transparent 40%)';
    appBg.style.backgroundColor = '#000';
  } else if (s === 'mesh_flou_2') {
    appBg.style.background = 'radial-gradient(ellipse at 10% 40%, '+c1+' 0, transparent 50%), radial-gradient(ellipse at 90% 30%, '+c2+' 0, transparent 60%), radial-gradient(circle at 60% 90%, '+c3+' 0, transparent 50%), radial-gradient(ellipse at 40% 10%, '+c1+' 0, transparent 40%)';
    appBg.style.backgroundColor = '#111';
  } else if (s === 'mesh_flou_3') {
    appBg.style.background = 'radial-gradient(circle at 0% 50%, '+c1+' 0, transparent 60%), radial-gradient(circle at 100% 50%, '+c2+' 0, transparent 60%), radial-gradient(circle at 50% 100%, '+c3+' 0, transparent 60%), radial-gradient(circle at 50% 0%, '+c2+' 0, transparent 60%)';
    appBg.style.backgroundColor = '#0a0a0a';
  } else if (s === 'mesh_flou_4') {
    appBg.style.background = 'radial-gradient(at 30% 70%, '+c1+' 0, transparent 70%), radial-gradient(at 70% 30%, '+c3+' 0, transparent 70%), radial-gradient(at 50% 50%, '+c2+' 0, transparent 50%)';
    appBg.style.backgroundColor = '#050505';
  } else if (s === 'mesh_hex') {
    appBg.style.background = 'radial-gradient(circle at 50% 50%, '+c1+' 2px, transparent 3px), radial-gradient(circle at 50% 50%, '+c2+' 2px, transparent 3px)';
    appBg.style.backgroundSize = '40px 40px';
    appBg.style.backgroundPosition = '0 0, 20px 20px';
    appBg.style.backgroundColor = c3;
  } else if (s === 'mesh_3d') {
    appBg.style.background = 'linear-gradient(45deg, '+c1+' 25%, transparent 25%, transparent 75%, '+c1+' 75%, '+c1+'), linear-gradient(45deg, '+c1+' 25%, transparent 25%, transparent 75%, '+c1+' 75%, '+c1+')';
    appBg.style.backgroundSize = '20px 20px';
    appBg.style.backgroundPosition = '0 0, 10px 10px';
    appBg.style.backgroundColor = c2;
  } else if (s === 'mesh_fine') {
    appBg.style.background = 'linear-gradient(90deg, '+c2+' 1px, transparent 1px), linear-gradient('+c2+' 1px, transparent 1px)';
    appBg.style.backgroundSize = '10px 10px';
    appBg.style.backgroundColor = c1;
  } else if (s === 'mesh_stars') {
    appBg.style.background = 'radial-gradient(circle, '+c2+' 1px, transparent 2px)';
    appBg.style.backgroundSize = '30px 30px';
    appBg.style.backgroundColor = c1;
  } else if (s === 'mesh_cyber') {
    appBg.style.background = 'linear-gradient(transparent 95%, '+c2+' 100%), linear-gradient(90deg, transparent 95%, '+c3+' 100%)';
    appBg.style.backgroundSize = '50px 50px';
    appBg.style.backgroundColor = c1;
  } else if (s === 'mesh_dots') {
    appBg.style.background = 'radial-gradient('+c2+' 15%, transparent 16%), radial-gradient('+c3+' 15%, transparent 16%)';
    appBg.style.backgroundSize = '60px 60px';
    appBg.style.backgroundPosition = '0 0, 30px 30px';
    appBg.style.backgroundColor = c1;
  } else if (s === 'mesh_waves') {
    appBg.style.background = 'repeating-radial-gradient(circle at 0 0, transparent 0, '+c1+' 10px), repeating-linear-gradient('+c2+', '+c2+')';
    appBg.style.backgroundColor = c3;
  } else if (s === 'mesh_isometric') {
    appBg.style.background = 'linear-gradient(30deg, '+c2+' 12%, transparent 12.5%, transparent 87%, '+c2+' 87.5%, '+c2+'), linear-gradient(150deg, '+c2+' 12%, transparent 12.5%, transparent 87%, '+c2+' 87.5%, '+c2+'), linear-gradient(30deg, '+c2+' 12%, transparent 12.5%, transparent 87%, '+c2+' 87.5%, '+c2+'), linear-gradient(150deg, '+c2+' 12%, transparent 12.5%, transparent 87%, '+c2+' 87.5%, '+c2+'), linear-gradient(60deg, '+c3+' 25%, transparent 25.5%, transparent 75%, '+c3+' 75%, '+c3+'), linear-gradient(60deg, '+c3+' 25%, transparent 25.5%, transparent 75%, '+c3+' 75%, '+c3+')';
    appBg.style.backgroundSize = '40px 70px';
    appBg.style.backgroundPosition = '0 0, 0 0, 20px 35px, 20px 35px, 0 0, 20px 35px';
    appBg.style.backgroundColor = c1;
  } else if (s === 'mesh_circuit') {
    appBg.style.background = 'linear-gradient(90deg, transparent 48%, '+c2+' 50%, transparent 52%), linear-gradient(0deg, transparent 48%, '+c2+' 50%, transparent 52%)';
    appBg.style.backgroundSize = '40px 40px';
    appBg.style.backgroundColor = c1;
  } else if (s === 'mesh_glitch') {
    appBg.style.background = 'repeating-linear-gradient(45deg, '+c1+', '+c1+' 10px, '+c2+' 10px, '+c2+' 20px, '+c3+' 20px, '+c3+' 30px)';
  } else if (s === 'mesh_honeycomb') {
    appBg.style.background = 'radial-gradient(circle at 50% 50%, transparent 60%, '+c2+' 61%, '+c2+' 65%, transparent 66%)';
    appBg.style.backgroundSize = '50px 50px';
    appBg.style.backgroundColor = c1;
  } else if (s === 'mesh_diamonds') {
    appBg.style.background = 'linear-gradient(135deg, transparent 45%, '+c2+' 50%, transparent 55%), linear-gradient(45deg, transparent 45%, '+c3+' 50%, transparent 55%)';
    appBg.style.backgroundSize = '30px 30px';
    appBg.style.backgroundColor = c1;
  } else if (s === 'mesh_crosshatch') {
    appBg.style.background = 'repeating-linear-gradient(45deg, transparent, transparent 5px, '+c2+' 5px, '+c2+' 6px), repeating-linear-gradient(-45deg, transparent, transparent 5px, '+c3+' 5px, '+c3+' 6px)';
    appBg.style.backgroundColor = c1;
  } else if (s === 'mesh_scales') {
    appBg.style.background = 'radial-gradient(circle at 100% 150%, '+c1+' 24%, '+c2+' 24%, '+c2+' 28%, '+c3+' 28%, '+c3+' 36%, transparent 36%), radial-gradient(circle at 0% 150%, '+c1+' 24%, '+c2+' 24%, '+c2+' 28%, '+c3+' 28%, '+c3+' 36%, transparent 36%)';
    appBg.style.backgroundSize = '40px 20px';
    appBg.style.backgroundColor = c1;
  } else if (s === 'mesh_carbon') {
    appBg.style.background = 'linear-gradient(27deg, '+c1+' 5px, transparent 5px) 0 5px, linear-gradient(207deg, '+c1+' 5px, transparent 5px) 10px 0px, linear-gradient(27deg, '+c2+' 5px, transparent 5px) 0px 10px, linear-gradient(207deg, '+c2+' 5px, transparent 5px) 10px 5px, linear-gradient(90deg, '+c3+' 10px, transparent 10px), linear-gradient('+c3+' 25%, '+c2+' 25%, '+c2+' 50%, transparent 50%, transparent 75%, '+c2+' 75%, '+c2+' 100%)';
    appBg.style.backgroundSize = '20px 20px';
  } else if (s === 'mesh_neon') {
    appBg.style.background = 'linear-gradient(90deg, transparent 90%, '+c2+' 100%), linear-gradient(0deg, transparent 90%, '+c3+' 100%)';
    appBg.style.backgroundSize = '40px 40px';
    appBg.style.backgroundColor = c1;
    appBg.style.boxShadow = 'inset 0 0 50px '+c2;
  } else if (s === 'mesh_fractal') {
    appBg.style.background = 'radial-gradient(circle at 50% 50%, '+c2+' 0%, transparent 50%), radial-gradient(circle at 0% 0%, '+c3+' 0%, transparent 50%), radial-gradient(circle at 100% 100%, '+c2+' 0%, transparent 50%)';
    appBg.style.backgroundSize = '100px 100px';
    appBg.style.backgroundColor = c1;
  } else if (s === 'mesh_radar') {
    appBg.style.background = 'repeating-radial-gradient(circle at center, transparent 0, transparent 20px, '+c2+' 21px), conic-gradient(from 0deg, transparent 70%, '+c3+' 100%)';
    appBg.style.backgroundSize = '100vw 100vh';
    appBg.style.backgroundColor = c1;
  } else if (s === 'mesh_blueprint') {
    appBg.style.background = 'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(rgba(255,255,255,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.05) 1px, transparent 1px)';
    appBg.style.backgroundSize = '100px 100px, 100px 100px, 20px 20px, 20px 20px';
    appBg.style.backgroundColor = '#0a2342';
  } else if (s === 'mesh_dna') {
    appBg.style.background = 'radial-gradient(circle at 20% 50%, '+c2+' 2px, transparent 3px), radial-gradient(circle at 80% 50%, '+c3+' 2px, transparent 3px)';
    appBg.style.backgroundSize = '30px 60px';
    appBg.style.backgroundColor = c1;
  } else if (s === 'diagonal') {
    appBg.style.background = 'linear-gradient(115deg, ' + c1 + ' 20%, ' + c2 + ' 50%, ' + c3 + ' 80%)';
  } else if (s === 'glow') {
    appBg.style.background = 'radial-gradient(circle at top left, '+c2+' 0%, transparent 40%), radial-gradient(circle at bottom right, '+c3+' 0%, transparent 40%), '+c1;
  } else if (s === 'aurora') {
    appBg.style.background = 'linear-gradient(to bottom, '+c1+', '+c1+'), radial-gradient(ellipse at top left, '+c2+' 0%, transparent 50%), radial-gradient(ellipse at top right, '+c3+' 0%, transparent 50%), radial-gradient(ellipse at bottom center, '+c2+' 0%, transparent 50%)';
    appBg.style.backgroundBlendMode = 'screen, screen, screen, normal';
    appBg.style.backgroundColor = c1;
  } else if (s === 'snow') {
    appBg.style.background = 'radial-gradient(circle at 10% 20%, rgba(255,255,255,0.1) 1px, transparent 1px), radial-gradient(circle at 50% 80%, rgba(255,255,255,0.1) 1.5px, transparent 1.5px), radial-gradient(circle at 80% 40%, rgba(255,255,255,0.1) 1px, transparent 1px), radial-gradient(circle at 30% 60%, rgba(255,255,255,0.1) 2px, transparent 2px), linear-gradient(135deg, '+c1+', '+c2+')';
  } else if (s === 'animated_waves') {
    appBg.style.background = 'linear-gradient(to bottom, '+c1+', '+c2+')';
    var awc = document.getElementById('animated-waves-container');
    if(!awc) {
        awc = document.createElement('div');
        awc.id = 'animated-waves-container';
        awc.className = 'animated-waves-container';
        awc.innerHTML = '<div class="wave wave1"></div><div class="wave wave2"></div><div class="wave wave3"></div>';
        if(!document.getElementById('anim-bg-styles')) {
            var style = document.createElement('style');
            style.id = 'anim-bg-styles';
            style.innerHTML = \`
                .animated-waves-container { position: fixed; bottom: 0; left: 0; width: 100vw; height: 100vh; overflow: hidden; z-index: -2; pointer-events: none; }
                .wave { position: absolute; bottom: 0; left: 0; width: 200%; height: 50vh; background-repeat: repeat-x; transform-origin: center bottom; }
                .wave1 { background-image: radial-gradient(ellipse at center, rgba(255,255,255,0.1) 0%, transparent 70%); animation: wave-move1 20s linear infinite; }
                .wave2 { background-image: radial-gradient(ellipse at center, rgba(255,255,255,0.05) 0%, transparent 60%); animation: wave-move2 25s linear infinite; height: 60vh; bottom: -10vh; }
                .wave3 { background-image: radial-gradient(ellipse at center, rgba(255,255,255,0.08) 0%, transparent 80%); animation: wave-move3 15s linear infinite; height: 40vh; }
                @keyframes wave-move1 { 0% { transform: translateX(0) translateZ(0) scaleY(1); } 50% { transform: translateX(-25%) translateZ(0) scaleY(0.8); } 100% { transform: translateX(-50%) translateZ(0) scaleY(1); } }
                @keyframes wave-move2 { 0% { transform: translateX(-50%) translateZ(0) scaleY(0.9); } 50% { transform: translateX(-25%) translateZ(0) scaleY(1.1); } 100% { transform: translateX(0) translateZ(0) scaleY(0.9); } }
                @keyframes wave-move3 { 0% { transform: translateX(0) translateZ(0) scaleY(1.2); } 50% { transform: translateX(-25%) translateZ(0) scaleY(0.9); } 100% { transform: translateX(-50%) translateZ(0) scaleY(1.2); } }

                .bg-animated-aurora { background: linear-gradient(45deg, var(--bg-c1), var(--bg-c2), var(--bg-c3), var(--bg-c1)); background-size: 400% 400%; animation: gradientBG 15s ease infinite; }
                .bg-moving-glows { background: var(--bg-c1); }
                .bg-moving-glows::before, .bg-moving-glows::after { content: ''; position: fixed; width: 60vw; height: 60vw; border-radius: 50%; filter: blur(80px); opacity: 0.5; z-index: -2; pointer-events: none; }
                .bg-moving-glows::before { background: var(--bg-c2); animation: moveGlow1 20s ease-in-out infinite alternate; top: -10%; left: -10%; }
                .bg-moving-glows::after { background: var(--bg-c3); animation: moveGlow2 25s ease-in-out infinite alternate; bottom: -10%; right: -10%; }
                @keyframes moveGlow1 { 0% { transform: translate(0, 0) scale(1); } 100% { transform: translate(30vw, 30vh) scale(1.5); } }
                @keyframes moveGlow2 { 0% { transform: translate(0, 0) scale(1); } 100% { transform: translate(-30vw, -30vh) scale(1.2); } }
            \`;
            document.head.appendChild(style);
        }
        document.body.appendChild(awc);
    }
    awc.style.display = 'block';
    // Update wave colors
    var waves = awc.querySelectorAll('.wave');
    if(waves.length >= 3) {
        waves[0].style.backgroundImage = 'radial-gradient(ellipse at center, ' + c2 + '80 0%, transparent 70%)';
        waves[1].style.backgroundImage = 'radial-gradient(ellipse at center, ' + c3 + '60 0%, transparent 60%)';
        waves[2].style.backgroundImage = 'radial-gradient(ellipse at center, ' + c1 + '80 0%, transparent 80%)';
    }

  } else if (s === 'animated_aurora') {
    document.documentElement.style.setProperty('--bg-c1', c1);
    document.documentElement.style.setProperty('--bg-c2', c2);
    document.documentElement.style.setProperty('--bg-c3', c3);
    appBg.classList.add('bg-animated-aurora');

  } else if (s === 'moving_glows') {
    document.documentElement.style.setProperty('--bg-c1', c1);
    document.documentElement.style.setProperty('--bg-c2', c2);
    document.documentElement.style.setProperty('--bg-c3', c3);
    appBg.classList.add('bg-moving-glows');

  } else if (s === 'animated_gradient') {
    appBg.style.background = 'linear-gradient(45deg, '+c1+', '+c2+', '+c3+', '+c1+')';
    appBg.classList.add('bg-animated-gradient');
  } else if (s === 'floating_shapes') {
    appBg.style.background = 'linear-gradient(to bottom right, '+c1+', '+c2+')';
    var fsc = document.getElementById('floating-shapes-container');
    if(!fsc) {
        fsc = document.createElement('div');
        fsc.id = 'floating-shapes-container';
        fsc.className = 'floating-shapes-container';
        fsc.style.zIndex = '-2';
        for(let i=0; i<15; i++) {
            let shape = document.createElement('div');
            shape.className = 'floating-shape';
            shape.style.width = (Math.random() * 100 + 20) + 'px';
            shape.style.height = shape.style.width;
            shape.style.left = (Math.random() * 100) + 'vw';
            shape.style.animationDuration = (Math.random() * 20 + 10) + 's';
            shape.style.animationDelay = (Math.random() * 10) + 's';
            fsc.appendChild(shape);
        }
        document.body.appendChild(fsc);
    }
    fsc.style.display = 'block';
  } else {
    appBg.style.background = c1 + ' radial-gradient(circle at 50% -20%, rgba(255,255,255,0.05) 0%, transparent 70%)';
  }
}`);

fs.writeFileSync('index.html', content);
