/*
  Author: Pranav Jha
  CruzID: 1973394
*/

function main() {  
  // Retrieve <canvas> element
  var canvas = document.getElementById('canvas');  
  if (!canvas) { 
    console.log('Failed to retrieve the <canvas> element');
    return false; 
  } 

  // Get the rendering context for 2DCG
  var ctx = canvas.getContext('2d');

  // Draw a black rectangle
  ctx.fillStyle = 'rgba(0, 0, 0, 1.0)';                   // Set color to black
  ctx.fillRect(0, 0, canvas.width, canvas.height);        // Fill a rectangle with the color
}

function handleDrawEvent() {
  // Get the center of the canvas
  let center_x = canvas.width / 2;
  let center_y = canvas.height / 2;
  var ctx = canvas.getContext('2d');

  // Reset upon new function call
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Get the location given by the user and multiply by 20
  let x1_offset = parseFloat(document.getElementById('x1-coord').value) * 20;
  let y1_offset = parseFloat(document.getElementById('y1-coord').value) * 20;
  let x2_offset = parseFloat(document.getElementById('x2-coord').value) * 20;
  let y2_offset = parseFloat(document.getElementById('y2-coord').value) * 20;

  // Get what operation to perform - (add, subtract, multiply, divide)
  let operation = document.getElementById('operation').value;

  // Make vectors
  var vCenter = new Vector3([center_x, center_y, 0]);				// Center of Canvas
  var v1 = new Vector3([center_x + x1_offset, center_y - y1_offset, 0]);	// v1 centered on the Canvas
  var v2 = new Vector3([center_x + x2_offset, center_y - y2_offset, 0]);	// v2 centered on the Canvas
  var v1_off_center = new Vector3([x1_offset, -y1_offset, 0]);			// v1 on WebGL's grid
  var v2_off_center = new Vector3([x2_offset, -y2_offset, 0]);			// v2 on WebGl's grid

  // Needed to calculate area
  var v1_unscaled = new Vector3([x1_offset/20, -y1_offset/20, 0]);		// v1 without scaling
  var v2_unscaled = new Vector3([x2_offset/20, -y2_offset/20, 0]);		// v2 without scaling

  // Draw the original vectors
  drawVector(v1, 'red');
  drawVector(v2, 'blue');

  // Get scalar value from user
  let scalar = parseFloat(document.getElementById('scalar').value);

  if (operation != 'none') {
    switch (operation) {
      case 'add':
        var v3 = new Vector3([0, 0, 0]);
        v3.set(v1);
        v3.add(v2_off_center);
        drawVector(v3, 'green');
        break;

      case 'sub':
        var v3 = new Vector3([0, 0, 0]);
        v3.set(v1);
        v3.sub(v2_off_center);
        drawVector(v3, 'green');
        break;

      case 'mul':
        if (isNaN(scalar)) {
          alert("Error: Please enter a scalar value if you want to perform multiplication");
          return;
        }
        var v3 = new Vector3([0, 0, 0]);
        v3.set(v1_off_center);
        v3.mul(scalar);
        v3.add(vCenter);
        drawVector(v3, 'green');

        v3.set(v2_off_center);
        v3.mul(scalar);
        v3.add(vCenter);
        drawVector(v3, 'green');
        break;

      case 'div':
        if (isNaN(scalar)) {
          alert("Error: Please enter a scalar value if you want to perform division");
          return;
        }
        if (scalar === 0) {
          alert("Error: Can't divide by 0");
          return;
        }
        var v3 = new Vector3([0, 0, 0]);
        v3.set(v1_off_center);
        v3.div(scalar);
        v3.add(vCenter);
        drawVector(v3, 'green');

        v3.set(v2_off_center);
        v3.div(scalar);
        v3.add(vCenter);
        drawVector(v3, 'green');
        break;

      case 'mag':
        console.log("Magnitude v1:", v1_unscaled.magnitude());
        console.log("Magnitude v2:", v2_unscaled.magnitude());
        break;

      case 'norm':
        var v3 = new Vector3([0, 0, 0]);
        v3.set(v1_off_center);
        v3.normalize();
        v3.mul(20);
        v3.add(vCenter);
        drawVector(v3, 'green');

        v3.set(v2_off_center);
        v3.normalize();
        v3.mul(20);
        v3.add(vCenter);
        drawVector(v3, 'green');
        break;

      case 'angle':
        angleBetween(v1_off_center, v2_off_center);
        break;

      case 'area':
        areaTriangle(v1_unscaled, v2_unscaled);
        break;
    }
  }
}

function angleBetween(v1, v2) {
  var alpha = (Vector3.dot(v1, v2)) / (v1.magnitude() * v2.magnitude());
  var angle = Math.acos(alpha) * (180 / Math.PI);
  console.log("Angle:", angle);
}

function areaTriangle(v1, v2) {
  var vec = Vector3.cross(v1, v2);
  console.log("Area of the triangle:", vec.magnitude() / 2);
}

function drawVector(vec, color) {
  var canvas = document.getElementById('canvas');
  var ctx = canvas.getContext('2d');

  let center_x = canvas.width / 2;
  let center_y = canvas.height / 2;
  var ctx = canvas.getContext('2d');

  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.moveTo(center_x, center_y);
  let v = vec.elements;
  ctx.lineTo(v[0], v[1]);
  ctx.stroke();
}
