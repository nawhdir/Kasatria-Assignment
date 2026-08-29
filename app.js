const GOOGLE_CLIENT_ID = '5414960301-uo4op5e4p1tk9uu7iha4l8o8b6jqhm0c.apps.googleusercontent.com';
const SPREADSHEET_ID = '1RT_Mq5R995zbledjEUaYfjeX88Im0oESxP-1pz16o-8';

let camera, scene, renderer, controls;
const objects = [];
const targets = { table: [], sphere: [], helix: [], grid: [] };


// Google authenthicate

window.onload = function () {

  google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: handleCredentialResponse
  });

  google.accounts.id.renderButton(
    document.getElementById('google-signin-btn'),
    { theme: 'outline', size: 'large', width: 260 }
  );
};

function handleCredentialResponse(response) {

  if (response.credential) {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('visualization-screen').classList.remove('hidden');
    fetchSheetData();
  }
}


// 3. google sheet data fetching n Parse

async function fetchSheetData() {

  const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json`;

  try {

    const response = await fetch(url);
    const text = await response.text();
    
    // Extract JSON payload
    const jsonString = text.substring(text.indexOf('{'), text.lastIndexOf('}') + 1);
    const data = JSON.parse(jsonString);
    
    const rows = data.table.rows.map(r => {


      if (!r || !r.c) return null;

      const [colName, colPhoto, colAge, colCountry, colInterest, colNetWorth] = r.c;
      const nameVal = colName && colName.v !== undefined ? String(colName.v) : '';
      const photoVal = colPhoto && colPhoto.v !== undefined ? String(colPhoto.v) : '';
      const ageVal = colAge && colAge.v !== undefined ? String(colAge.v) : '';
      const countryVal = colCountry && colCountry.v !== undefined ? String(colCountry.v) : '';
      const interestVal = colInterest && colInterest.v !== undefined ? String(colInterest.v) : '';
      const rawNetWorth = colNetWorth ? (colNetWorth.v !== undefined ? colNetWorth.v : colNetWorth.f) : 0;
      const numNetWorth = parseFloat(String(rawNetWorth).replace(/[^0-9.-]+/g, '')) || 0;
      const formattedNetWorth = '$' + numNetWorth.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2

      });

      return {

        name: nameVal,
        photo: photoVal,
        age: ageVal,
        country: countryVal,
        interest: interestVal,
        netWorthStr: formattedNetWorth,
        netWorthVal: numNetWorth

      };
    }).filter(item => item !== null && item.name.trim() !== '');

    console.log('Successfully loaded items:', rows.length, rows);
    initThreeJS(rows);
  } catch (error) {
    console.error('Error fetching sheet data:', error);
    alert('Failed to load Google Sheet data. Please ensure the Google Sheet is shared as "Anyone with the link can view".');
  }
}



// three.js initialize & setup


function initThreeJS(dataItems) {

  camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 1, 10000);
  camera.position.z = 3000;

  scene = new THREE.Scene();

  for (let i = 0; i < dataItems.length; i++) {
    const item = dataItems[i];

    const element = document.createElement('div');
    element.className = 'element';

    // Determine Net Worth color class
    let colorClass = 'net-worth-high';
    if (item.netWorthVal < 100000) {
      colorClass = 'net-worth-low';
    } else if (item.netWorthVal < 200000) {
      colorClass = 'net-worth-mid';
    }

    const fallbackAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(item.name || 'User')}&background=random`;

    element.innerHTML = `
      <div class="element-card ${colorClass}">
        <div class="element-header">
          <span>${item.country || 'N/A'}</span>
          <span>Age: ${item.age || '-'}</span>
        </div>
        <div class="element-photo-wrapper">
          <img class="element-photo" 
               src="${item.photo}" 
               alt="${item.name}" 
               referrerpolicy="no-referrer"
               onerror="this.onerror=null; this.src='${fallbackAvatar}';">
        </div>
        <div class="element-body">
          <div class="element-name" title="${item.name}">${item.name}</div>
          <div class="element-interest">${item.interest}</div>
          <div class="element-networth">${item.netWorthStr}</div>
        </div>
      </div>
    `;

    const objectCSS = new THREE.CSS3DObject(element);
    objectCSS.position.x = Math.random() * 4000 - 2000;
    objectCSS.position.y = Math.random() * 4000 - 2000;
    objectCSS.position.z = Math.random() * 4000 - 2000;
    scene.add(objectCSS);

    objects.push(objectCSS);
  }

  const count = dataItems.length;




  // Table view (20 x 10)


  const tableCols = 20;
  const tableSpacingX = 175;
  const tableSpacingY = 210;
  const tableOffsetX = (tableCols * tableSpacingX) / 2 - tableSpacingX / 2;
  const tableOffsetY = (10 * tableSpacingY) / 2 - tableSpacingY / 2;

  for (let i = 0; i < count; i++) {
    const col = i % tableCols;
    const row = Math.floor(i / tableCols);

    const object = new THREE.Object3D();
    object.position.x = (col * tableSpacingX) - tableOffsetX;
    object.position.y = -(row * tableSpacingY) + tableOffsetY;
    object.position.z = 0;

    targets.table.push(object);
  }

  
  // Sphere view
  

  const vector = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    const phi = Math.acos(-1 + (2 * i) / count);
    const theta = Math.sqrt(count * Math.PI) * phi;

    const object = new THREE.Object3D();
    object.position.setFromSphericalCoords(900, phi, theta);

    vector.copy(object.position).multiplyScalar(2);
    object.lookAt(vector);

    targets.sphere.push(object);
  }


  // Double helix view


  const helixRadius = 850;
  const itemsPerStrand = Math.ceil(count / 2);
  const totalTurns = 3.5; 
  const angleStep = (totalTurns * 2 * Math.PI) / itemsPerStrand;
  const ySpacing = 28; 
  const totalHeight = itemsPerStrand * ySpacing;
  const yOffset = totalHeight / 2;

  for (let i = 0; i < count; i++) {

    const strand = i % 2; 
    const step = Math.floor(i / 2);
    const theta = step * angleStep + (strand * Math.PI);
    const y = -(step * ySpacing) + yOffset;
    const object = new THREE.Object3D();
    object.position.setFromCylindricalCoords(helixRadius, theta, y);
    
    vector.x = object.position.x * 2;
    vector.y = object.position.y;
    vector.z = object.position.z * 2;
    object.lookAt(vector);

    targets.helix.push(object);

  }


  
  // Layout 4: grid view (5 x 4 x 10)
  

  const gridXCount = 5;
  const gridYCount = 4;
  const gridSpacingX = 220;
  const gridSpacingY = 240;
  const gridSpacingZ = 320;

  const gridOffsetX = (gridXCount * gridSpacingX) / 2 - gridSpacingX / 2;
  const gridOffsetY = (gridYCount * gridSpacingY) / 2 - gridSpacingY / 2;
  const gridOffsetZ = (10 * gridSpacingZ) / 2 - gridSpacingZ / 2;

  for (let i = 0; i < count; i++) {
    const xIndex = i % 5;
    const yIndex = Math.floor(i / 5) % 4;
    const zIndex = Math.floor(i / 20);

    const object = new THREE.Object3D();
    object.position.x = (xIndex * gridSpacingX) - gridOffsetX;
    object.position.y = -(yIndex * gridSpacingY) + gridOffsetY;
    object.position.z = -(zIndex * gridSpacingZ) + gridOffsetZ;

    targets.grid.push(object);
  }

  






  // renderer & controls
  
  renderer = new THREE.CSS3DRenderer();
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.getElementById('container').appendChild(renderer.domElement);

  controls = new THREE.TrackballControls(camera, renderer.domElement);
  controls.minDistance = 500;
  controls.maxDistance = 6000;
  controls.addEventListener('change', render);

  bindButton('table', targets.table);
  bindButton('sphere', targets.sphere);
  bindButton('helix', targets.helix);
  bindButton('grid', targets.grid);

  transform(targets.table, 2000);

  window.addEventListener('resize', onWindowResize);
  animate();
}

function bindButton(id, target) {

  const button = document.getElementById(id);

  button.addEventListener('click', function () {
    document.querySelectorAll('#menu button').forEach(b => b.classList.remove('active'));
    this.classList.add('active');
    transform(target, 2000);
  });


}

function transform(targets, duration) {

  TWEEN.removeAll();

  for (let i = 0; i < objects.length; i++) {
    const object = objects[i];
    const target = targets[i];

    if (!target) continue;

    new TWEEN.Tween(object.position)
      .to({ x: target.position.x, y: target.position.y, z: target.position.z }, Math.random() * duration + duration)
      .easing(TWEEN.Easing.Exponential.InOut)
      .start();

    new TWEEN.Tween(object.rotation)
      .to({ x: target.rotation.x, y: target.rotation.y, z: target.rotation.z }, Math.random() * duration + duration)
      .easing(TWEEN.Easing.Exponential.InOut)
      .start();
  }

  new TWEEN.Tween(this)
    .to({}, duration * 2)
    .onUpdate(render)
    .start();
}

function onWindowResize() {

  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  render();
}

function animate() {

  requestAnimationFrame(animate);
  TWEEN.update();
  controls.update();
}

function render() {

  renderer.render(scene, camera);
}
