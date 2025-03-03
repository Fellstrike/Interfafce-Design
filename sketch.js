let blockColors;
let blocks = [];
let people = [];
let maxPeople = 15;  // Maximum number of people to track

let camFeed;
let video;
let bodies = [];

let smoothingFactor = 0.15;
let smoothedKeypoints = {};
let blockSize = 8;
let maxHP = 8;  // Blocks start at full HP and fade out
let blockInvulTime = 10;  // Invulnerability time after being hit (frames)

let lastMouse = true;

let usedColors = [];
let colorIndex = 0;

function preload() {
  camFeed = ml5.bodyPose("MoveNet", { flipped: true });
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  background(0);

  video = createCapture(VIDEO);
  video.size(width, height);
  video.hide();

  camFeed.detectStart(video, bodyCheck);

  blockColors = [
    color(255, 0, 0), color(0, 255, 0), color(0, 0, 255),
    color(255, 255, 0), color(255, 0, 255), color(0, 255, 255),
    color(128, 0, 255), color(0, 128, 255), color(128, 128, 255),
    color(255, 128, 0), color(255, 0, 128), color(255, 128, 128),
    color(0, 255, 128), color(128, 255, 0), color(128, 255, 128)
  ];

  shuffle(blockColors, true);

  window.addEventListener("beforeunload", saveBlocks);

  loadBlocks();
}

function loadBlocks() {
  let savedData = localStorage.getItem("savedBlocks");
  if (savedData != null) {
    let blockData = JSON.parse(savedData);
    blocks = blockData.map(b => new Block(b.x, b.y, color(b.color), b.hp));
  }
}

function draw() {
  background(0);

  // Draw stored blocks
  for (let b of blocks) {
    b.display();
    b.tempInvul = min(0, b.tempInvul - 1);
  }

  if (bodies.length > 0) {
    drawBodies();
  }

  if (frameCount % 300 === 0) { // Save every 5 seconds (assuming 60 FPS)
    saveBlocks();
  }
}

function drawBodies() {
  for (let body of bodies) {
    let person = findPersonById(body.id);
    //console.log(person);
    person.toggleCooldown = max(0, person.toggleCooldown - 1);

    let col = person.color;
    stroke(col);
    strokeWeight(5);

    smoothBodyPoints(body);

    let head = smoothedKeypoints[body.id][0];  // Head position
    let leftWrist = smoothedKeypoints[body.id][9];
    let rightWrist = smoothedKeypoints[body.id][10];

    fill(col);

    // Determine main hand based on hand lifted above head
    // Check which hand is above the head
    if (leftWrist.y < head.y && rightWrist.y < head.y) {
      // If both are above, keep the previous main hand or choose the faster one
      person.mainHand = 'right'; // Default to right hand
    } else if (leftWrist.y < head.y) {
      person.mainHand = 'left';
    } else if (rightWrist.y < head.y) {
      person.mainHand = 'right';
    }

    let hand = person.mainHand === 'left' ? leftWrist : rightWrist;
   
    if (person.mainHand === 'right' && person.toggleCooldown <= 0) {
      // Check if the left hand is by the right shoulder
      if (dist(leftWrist.x, leftWrist.y, smoothedKeypoints[body.id][6].x, smoothedKeypoints[body.id][6].y) < 80) { 
        person.drawMode = !person.drawMode;
        person.toggleCooldown = 60; // Prevents rapid toggling
      }
    }
    else if (person.mainHand === 'left' && person.toggleCooldown <= 0) {
      // Check if the right hand is by the left shoulder
      if (dist(smoothedKeypoints[body.id][10].x, smoothedKeypoints[body.id][10].y, smoothedKeypoints[body.id][5].x, smoothedKeypoints[body.id][5].y) < 80) { 
        person.drawMode = !person.drawMode;
        person.toggleCooldown = 60; // Prevents rapid toggling
      }
    }

    // Draw stick figure at hand position
    drawHandStickFigure(hand.x, hand.y, person.drawMode, col);

    let handSpeed = dist(hand.x, hand.y, person.prevX, person.prevY);
    let steadyThreshold = 2.0; // Lowered threshold for more responsive painting

    if (handSpeed > steadyThreshold) {
      if (person.drawMode) {
        sprayBlocks(hand.x, hand.y, col);  // Create spray effect at hand position
      } else {
        eraseInsideHead(hand.x, hand.y, 40);  // Gradually erase blocks at hand position
      }
    }

    person.prevX = hand.x;
    person.prevY = hand.y;
    person.prevLeftX = leftWrist.x;
    person.prevLeftY = leftWrist.y;
    person.prevRightX = rightWrist.x;
    person.prevRightY = rightWrist.y;
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

// **Gradually erase blocks inside the head area**
function eraseInsideHead(x, y, radius) {
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

function drawHandStickFigure(x, y, isDrawMode, baseColor) {
  push();
  strokeWeight(5);
  stroke(200);
  fill(isDrawMode ? baseColor : color(red(baseColor), green(baseColor), blue(baseColor), 85));  // Transparent in erase mode

  // Head
  ellipse(x, y, 60, 60);

  // Body
  line(x, y + 30, x, y + 80);

  line(x - 38, y + 60, x, y + 40); //left arm
  line(x, y + 40, x + 38, y + 60); //right arm

  line(x, y + 80, x - 14, y + 120); //left leg
  line(x, y + 80, x + 14, y + 120); //right leg

  // Arms and Legs (change Position between modes)
  if (isDrawMode) {
    line(x -53, y + 15, x - 20, y + 80); // Representing a pencil/pen/brush
    line(x - 20, y + 80, x - 25, y + 95); // Tip of the brush/pen
  } else {
    rect(x - 53, y + 35 , 40, 20); // Representing a giant eraser
  }

  pop();

  push();
  strokeWeight(2);
  stroke(baseColor);
  fill(isDrawMode ? baseColor : color(red(baseColor), green(baseColor), blue(baseColor), 85));  // Transparent in erase mode

  // Head
  ellipse(x, y, 60, 60);

  // Body
  line(x, y + 30, x, y + 80);

  line(x - 38, y + 60, x, y + 40); //left arm
  line(x, y + 40, x + 38, y + 60); //right arm

  line(x, y + 80, x - 14, y + 120); //left leg
  line(x, y + 80, x + 14, y + 120); //right leg

  if (isDrawMode) {
    line(x -53, y + 15, x - 20, y + 80); // Representing a pencil/pen/brush
    line(x - 20, y + 80, x - 25, y + 95); // Tip of the brush/pen
  } else {
    rect(x - 53, y + 35 , 40, 20); // Representing a giant eraser
  }

  pop();
}

function saveBlocks() {
  let blockData = blocks.map(b => ({ x: b.x, y: b.y, color: [red(b.color), green(b.color), blue(b.color), alpha(b.color)], hp: b.hp }));
  localStorage.setItem("savedBlocks", JSON.stringify(blockData));
}

function bodyCheck(results) {
  bodies = results;
  let trackedIds = bodies.map(body => body.id);

  // Update last seen time for tracked people
  for (let person of people) {
    if (trackedIds.includes(person.id)) {
      person.lastSeen = millis();
    }
  }

  // Remove people who haven't been seen for a longer duration
  people = people.filter(person => millis() - person.lastSeen < 8000); // Increased timeout to 8 seconds

  // Add new people
  for (let body of bodies) {
    //console.log(body);
    if (!findPersonById(body.id)) {
      people.push(new Person(body.id));
    }
  }
  console.log(people);
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

class Person {
  constructor(bodyID) {
    this.id = bodyID;
    this.color = this.assignUniqueColor();
    this.drawMode = true;
    this.lastSeen = millis();
    this.prevX = 0;
    this.prevY = 0;
    this.toggleCooldown = 120;
    this.mainHand = null;
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

// Smooth keypoints using EMA (low-pass filter)
function smoothBodyPoints(body) {
  if (!smoothedKeypoints[body.id]) {
    smoothedKeypoints[body.id] = body.keypoints.map(kp => ({ x: kp.x, y: kp.y }));
  } else {
    for (let i = 0; i < body.keypoints.length; i++) {
      smoothedKeypoints[body.id][i].x = lerp(smoothedKeypoints[body.id][i].x, body.keypoints[i].x, smoothingFactor);
      smoothedKeypoints[body.id][i].y = lerp(smoothedKeypoints[body.id][i].y, body.keypoints[i].y, smoothingFactor);
    }
  }
}

function isFist(wrist, thumb, index, pinkie) {
  let thumbDist = dist(wrist.x, wrist.y, thumb.x, thumb.y);
  let indexDist = dist(wrist.x, wrist.y, index.x, index.y);
  let middleDist = dist(thumb.x, thumb.y, index.x, index.y);
  let ringDist = dist(thumb.x, thumb.y, pinkie.x, pinkie.y);
  let pinkieDist = dist(wrist.x, wrist.y, pinkie.x, pinkie.y);

  let fistThreshold = 80; // Adjust as needed
  
  return (thumbDist <= fistThreshold && indexDist <= fistThreshold && middleDist <= fistThreshold && ringDist <= fistThreshold && pinkieDist <= fistThreshold);
}

function findPersonById(id) {
  return people.find(person => person.id === id);
}