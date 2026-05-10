<<<<<<< SEARCH
  var addMvBtn = document.createElement('button');
  addMvBtn.className = 'btn o';
  addMvBtn.style.marginTop = '12px';
  addMvBtn.style.alignSelf = 'flex-start';
  addMvBtn.innerHTML = '⊞ Ajouter au Multivision (Attente du flux)';
  addMvBtn.id = 'mv-add-btn';
  addMvBtn.disabled = true;
  document.getElementById('mmeta').appendChild(addMvBtn);
=======
  var addMvBtn = document.createElement('button');
  addMvBtn.className = 'btn o';
  addMvBtn.style.marginTop = '16px';
  addMvBtn.style.alignSelf = 'center';
  addMvBtn.style.width = '100%';
  addMvBtn.innerHTML = '⊞ Ajouter au Multivision (Attente du flux)';
  addMvBtn.id = 'mv-add-btn';
  addMvBtn.disabled = true;
  // Since mmeta is cleared, append to mname which is our unified header
  document.getElementById('mname').appendChild(addMvBtn);
>>>>>>> REPLACE
