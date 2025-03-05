let blockColors;
let blocks = [];
let people = [];
let maxPeople = 4;  // Maximum number of people to track

let camFeed;
let video;
let bodies = [];

let smoothingFactor = 0.15;
let pCooldownMax = 180;
let wristDistance = 260;

let blockSize = 8;
let maxHP = 8;  // Blocks start at full HP and fade out
let blockInvulTime = 10;  // Invulnerability time after being hit (frames)

let mouseDrawMode = true;

let usedColors = [];
let colorIndex = 0;

function preload() {
  camFeed = ml5.bodyPose("MoveNet", { flipped: true });
}

function setup() {

  //map canvas to video resolution.
  video = createCapture(VIDEO);
  video.size(windowWidth, windowHeight);
  video.hide();

  let canvasWidth = video.width * 0.95;
  let canvasHeight = video.height * 0.95;

  createCanvas(canvasWidth, canvasHeight);
  background(0);

  camFeed.detectStart(video, bodyCheck);

  blockColors = [
    color(255, 0, 0), color(0, 255, 0), color(0, 0, 255),
    color(255, 255, 0), color(255, 0, 255), color(0, 255, 255),
    color(128, 0, 255), color(0, 128, 255), color(128, 128, 255),
    color(255, 128, 0), color(255, 0, 128), color(255, 128, 128),
    color(0, 255, 128), color(128, 255, 0), color(128, 255, 128)
  ];

  shuffle(blockColors, true);

  //window.addEventListener("beforeunload", saveBlocks);

  //loadBlocks();

  frameRate(60);

  noCursor();
}

/*function loadBlocks() {
  let savedData = localStorage.getItem("savedBlocks");
  if (savedData != null) {
    let blockData = JSON.parse(savedData);
    blocks = blockData.map(b => new Block(b.x, b.y, color(b.color), b.hp));
  }
}*/

function draw() {
  background(0);
  /* DRAWS WHAT WEB CAM IS SEEING
  push();
  translate(width,0);
  scale(-1, 1);
  image(video, 0, 0, width, height);
  pop(); */

  // Draw stored blocks
  for (let b of blocks) {
    b.display();
    b.tempInvul = max(0, b.tempInvul - 1);
  }

  if (people.length > 0) {
    drawBodies();
  }

 /* if (frameCount % 300 === 0) { // Save every 5 seconds (assuming 60 FPS)
    saveBlocks();
  } */
}

function drawBodies() {
  let headOffset = 20;

  for (let person of people) {

    person.toggleCooldown = max(0, person.toggleCooldown - 1);

    // Determine main hand based on hand lifted above head

    if (person.leftWrist.y < person.head.y - headOffset && person.mainHand === 'right' && person.toggleCooldown == 0) {
      person.mainHand = 'left';
      person.color = person.assignUniqueColor();
      console.log("Artist #" + person.id + " has changed colors.");
      person.toggleCooldown = pCooldownMax;
    } else if (person.rightWrist.y < person.head.y - headOffset && person.mainHand === 'left' && person.toggleCooldown == 0) {
      person.mainHand = 'right';
      person.color = person.assignUniqueColor();
      console.log("Artist #" + person.id + " has changed colors.");
      person.toggleCooldown = pCooldownMax;
    }
    else if (person.leftWrist.y < person.head.y && person.rightWrist.y < person.head.y && person.toggleCooldown == 0) {
      // Check if the left hand is by the right shoulder
        person.drawMode = !person.drawMode;
        person.toggleCooldown = pCooldownMax;
    }

    let hand = person.mainHand === 'left' ? person.leftWrist : person.rightWrist;

    let handSpeed = dist(hand.x, hand.y, person.prevX, person.prevY);
    let steadyThreshold = 2.0; // Lowered threshold for more responsive painting

    if (handSpeed > steadyThreshold) {
      if (person.drawMode) {
        sprayBlocks(hand.x, hand.y, person.color);  // Create spray effect at hand position
      } else {
        gradualErase(hand.x, hand.y, 40);  // Gradually erase blocks at hand position
      }
    }

    person.prevX = hand.x;
    person.prevY = hand.y;

    drawCursor(person);
  }
}

// **Spray random blocks inside the head area**
function sprayBlocks(x, y, baseColor) {
  let numBlocks = 10; // Number of blocks per spray
  let sprayRadius = 30; // Spray area size

  for (let i = 0; i < numBlocks; i++) {
    let angle = random(TWO_PI);
    let radius = random(sprayRadius);
    let blockX = x + cos(angle) * radius;
    let blockY = y + sin(angle) * radius;

    let gridX = floor(blockX / blockSize) * blockSize;
    let gridY = floor(blockY / blockSize) * blockSize;

    let existingBlock = blocks.find(b => 
      b.x === gridX && b.y === gridY && 
      red(b.color) === red(baseColor) &&
      green(b.color) === green(baseColor) &&
      blue(b.color) === blue(baseColor)
    );

    if (!existingBlock) {
      let newColor = color(red(baseColor), green(baseColor), blue(baseColor), 255);
      blocks.push(new Block(gridX, gridY, newColor));
    }
  }
}

// **Gradually erase blocks inside the eraser area**
function gradualErase(x, y, radius) {
  for (let i = blocks.length - 1; i >= 0; i--) {
    let b = blocks[i];
    let d = dist(b.x, b.y, x, y);
    
    if (d < radius && b.tempInvul <= 0) {
      b.tempInvul = blockInvulTime;  // Temporary invulnerability to prevent rapid erasing
      b.hp--;  // Reduce HP
      let alphaVal = map(b.hp, 0, maxHP, 0, 255); // Fade effect
      b.color = color(red(b.color), green(b.color), blue(b.color), alphaVal);

      if (b.hp <= 0) {
        blocks.splice(i, 1);  // Remove when fully faded
      }
    }
  }
}

function drawCursor(person) {
  push();
  strokeWeight(6);
  stroke(200);
  let baseColor = person.color;
  fill(person.drawMode ? baseColor : color(red(baseColor), green(baseColor), blue(baseColor), 85));  // Transparent in erase mode
  let offset = -76;
  let x = person.rightWrist.x;
  let y = person.rightWrist.y;

  if (person.mainHand === 'left') {
    offset = 0;
    x = person.leftWrist.x;
    y = person.leftWrist.y;
  }
  //Label
  textAlign(CENTER);
  textSize(min(width, height) * 0.03);
  text("Artist " + person.id, x + 38 + offset, y + 85);

  // Head
  ellipse(x + 38 + offset, y - 50, 60, 60);

  // Body
  line(x + 38 + offset, y - 20, x + 38 + offset, y + 30);

  line(x + 38 + offset, y - 10, x + offset, y + 10); //right arm
  line(x + 38 + offset, y - 10, x + 76 + offset, y + 10); //left arm

  line(x + 38 + offset, y + 30, x + 24 + offset, y + 70); //left leg
  line(x + 38 + offset, y + 30, x + 52 + offset, y + 70); //right leg

  // Change Between an Eraser and Spray Paint
  if (person.drawMode) {
    fill(red(baseColor), green(baseColor), blue(baseColor), 85);
    ellipse(x, y, 40);
    fill(baseColor);
    ellipse(x, y + 35, 15);
    beginShape();
    vertex(x - 7.5, y + 35);
    vertex(x - 7.5, y + 10);
    vertex(x + 7.5, y + 10);
    vertex(x + 7.5, y + 35);
    endShape();
    ellipse(x, y + 10, 15);
    fill(0);
    rect(x - 2.5, y + 7, 5, 5);
    fill(baseColor);
  } 
    
  else {
    fill(red(baseColor), green(baseColor), blue(baseColor), 85);
    rect(x - 12.5, y - 20, 25, 50); // Representing a giant eraser
    beginShape();
    vertex(x - 12.5, y - 20);
    vertex(x - 14, y - 15);
    vertex(x - 14, y + 25);
    vertex(x - 12.5, y + 25);
    vertex(x + 12.5, y + 25);
    vertex(x + 11, y + 25);
    vertex(x - 14, y + 25);
    vertex(x- 14, y - 20);
    endShape();
  }

  pop();

  push();
  strokeWeight(2);
  stroke(baseColor);
  fill(baseColor);  // Transparent in erase mode

  // Head
  ellipse(x + 38 + offset, y - 50, 60, 60);

  // Body
  line(x + 38 + offset, y - 20, x + 38 + offset, y + 30);

  line(x + 38 + offset, y - 10, x + offset, y + 10); //right arm
  line(x + 38 + offset, y - 10, x + 76 + offset, y + 10); //left arm

  line(x + 38 + offset, y + 30, x + 24 + offset, y + 70); //left leg
  line(x + 38 + offset, y + 30, x + 52 + offset, y + 70); //right leg

  if (person.drawMode) {
    fill(red(baseColor), green(baseColor), blue(baseColor), 85);
    ellipse(x, y, 40);
    fill(baseColor);
    ellipse(x, y + 35, 15);
    beginShape();
    vertex(x - 7.5, y + 35);
    vertex(x - 7.5, y + 10);
    vertex(x + 7.5, y + 10);
    vertex(x + 7.5, y + 35);
    endShape();
    ellipse(x, y + 10, 15);
    fill(0);
    rect(x - 2.5, y + 7, 5, 5);
    fill(baseColor);
  } 
  
  else {
    fill(red(baseColor), green(baseColor), blue(baseColor), 85);
    rect(x - 12.5, y - 20, 25, 50); // Representing a giant eraser
    beginShape();
    vertex(x - 12.5, y - 20);
    vertex(x - 14, y - 15);
    vertex(x - 14, y + 25);
    vertex(x - 12.5, y + 25);
    vertex(x + 12.5, y + 25);
    vertex(x + 11, y + 25);
    vertex(x - 14, y + 25);
    vertex(x- 14, y - 20);
    //vertex(x - 20, y - 10);
    endShape();
  }

  pop();
}

function saveBlocks() {
  let blockData = blocks.map(b => ({ x: b.x, y: b.y, color: [red(b.color), green(b.color), blue(b.color), alpha(b.color)], hp: b.hp }));
  localStorage.setItem("savedBlocks", JSON.stringify(blockData));
}

function bodyCheck(results) {
  bodies = results;
  
  for(let i = people.length; people.length < bodies.length && i < maxPeople; i = people.length) {
    people.push(new Person(bodies[i]));
    console.log("New Artist Detected. Artist #" + bodies[i].id);
  }

  for (let c = 0; c < people.length; c++) {
    for (let body of bodies) {
      if (people[c].id === body.id || dist(people[c].head.x, people[c].head.y, body.keypoints[0].x, body.keypoints[0].y) < 10) {
        people[c].updateLoc(body);
        //if (people[c].id === people[c -1].id)
      }
    }
  }

  console.log(people.length);

  // Remove people who haven't been seen for a longer duration
  people = people.filter(person => millis() - person.lastSeen < 8000); // Increased timeout to 8 seconds
}

function mouseClicked() {
  if (mouseButton === LEFT) {
    mouseDrawMode = !mouseDrawMode;
  }
  for (let person of people) {
    person.drawMode = !person.drawMode;
  }
}

class Block {
  constructor(x, y, color) {
    this.x = x;
    this.y = y;
    this.color = color;
    this.hp = maxHP;  // Blocks start at full HPa
    this.tempInvul = 0;
  }

  display() {
    fill(this.color);
    noStroke();
    rect(this.x, this.y, blockSize, blockSize);
  }
}

//follow smoothedBody function to transfer bodyKeypoint coordinates to the person object/people array.
class Person {
  constructor(body) {
    this.id = body.id;
    this.color = this.assignUniqueColor();
    this.drawMode = true;
    this.lastSeen = millis();
    this.prevX = 0;
    this.prevY = 0;
    this.toggleCooldown = 120;
    this.mainHand = 'right';
    this.head = body.keypoints[0];
    this.leftWrist = body.keypoints[9];
    this.rightWrist = body.keypoints[10];
  }

  // Smooth keypoints using EMA (low-pass filter)
  updateLoc(body) {
    this.head.x = lerp(this.head.x, body.keypoints[0].x, smoothingFactor);
    this.head.y = lerp(this.head.y, body.keypoints[0].y, smoothingFactor);
    this.leftWrist.x = lerp(this.leftWrist.x, body.keypoints[9].x, smoothingFactor);
    this.leftWrist.y = lerp(this.leftWrist.y, body.keypoints[9].y, smoothingFactor);
    this.rightWrist.x = lerp(this.rightWrist.x, body.keypoints[10].x, smoothingFactor);
    this.rightWrist.y = lerp(this.rightWrist.y, body.keypoints[10].y, smoothingFactor);
    this.lastSeen = millis();
  }

  assignUniqueColor() {
    if (usedColors.length >= blockColors.length) {
      usedColors = [];
      colorIndex = 0;
    }

    while (usedColors.includes(blockColors[colorIndex])) {
      colorIndex = (colorIndex + 1) % blockColors.length;
    }

    let assignedColor = blockColors[colorIndex];
    usedColors.push(assignedColor);
    colorIndex = (colorIndex + 1) % blockColors.length;

    return assignedColor;
  }
}