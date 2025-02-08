/*      NEEDS WORK
    fix how rapidly the id
*/
let blockColors;
let blocks = [];

let people = [];
let maxPeople = 1;

let camFeed;
let video;
let bodies = [];

function preload() {
  camFeed = ml5.bodyPose("MoveNet", { flipped: true });
}

function setup() {
  createCanvas(800, 600);
  background(0);

  video = createCapture(VIDEO);
  video.size(width, height);
  video.hide();

  // Start body pose detection
  camFeed.detectStart(video, bodyCheck);

  blockColors = [
    color(255, 0, 0),    // Red
    color(0, 255, 0),    // Green
    color(0, 0, 255),    // Blue
    color(255, 255, 0),  // Yellow
    color(255, 0, 255),  // Purple
    color(0, 255, 255),  // Teal
    color(128, 0, 255),  // Indigo
    color(0, 128, 255),  // Sky Blue
    color(128, 128, 255),  // Periwinkle
    color(255, 128, 0),  // Orange
    color(255, 0, 128),  // Fuscia
    color(255, 128, 128),  // Pink
    color(0, 255, 128),   // sage
    color(128, 255, 0),   // lime
    color(128, 255, 128)   // mint
  ];

  // Disable right-click on the canvas
  for (let element of document.getElementsByClassName("p5Canvas")) {
    element.addEventListener("contextmenu", (e) => e.preventDefault());
  }
}

function draw() {
  background(0);
  if (blocks.length != 0) {
    for (let c = 0; c < blocks.length; c++) {
      blocks[c].display();
    }
  }
  if (bodies.length > 0) {
    drawBodies();
  }
}

function drawBodies() {
  for (let i = 0; i < bodies.length; i++) {
    let body = bodies[i];

    let person = findPersonById(body.id);
    if (!person) {
      person = new Person(body.id);
      people.push(person);
    }

    let col = person.color;
    stroke(col);
    strokeWeight(5);
    //noFill();

    // Draw head
    let head = body.keypoints[0];
    fill(col);
    circle(head.x, head.y + 70, 180);

    // Draw arms
    strokeWeight(25);
    line(body.keypoints[5].x, body.keypoints[5].y, body.keypoints[7].x, body.keypoints[7].y); // Left arm
    line(body.keypoints[7].x, body.keypoints[7].y, body.keypoints[9].x, body.keypoints[9].y);
    line(body.keypoints[6].x, body.keypoints[6].y, body.keypoints[8].x, body.keypoints[8].y); // Right arm
    line(body.keypoints[8].x, body.keypoints[8].y, body.keypoints[10].x, body.keypoints[10].y);

    // Draw body
    rect(body.keypoints[5].x, body.keypoints[5].y, (body.keypoints[6].x - body.keypoints[5].x), (body.keypoints[11].y - body.keypoints[5].y));
    /*
    line(body.keypoints[5].x, body.keypoints[5].y, body.keypoints[6].x, body.keypoints[6].y); // Shoulders
    line(body.keypoints[5].x, body.keypoints[5].y, body.keypoints[11].x, body.keypoints[11].y); // Left torso
    line(body.keypoints[6].x, body.keypoints[6].y, body.keypoints[12].x, body.keypoints[12].y); // Right torso
    line(body.keypoints[11].x, body.keypoints[11].y, body.keypoints[12].x, body.keypoints[12].y); // Hips
    
    // Draw legs
    line(body.keypoints[11].x, body.keypoints[11].y, body.keypoints[13].x, body.keypoints[13].y); // Left leg
    line(body.keypoints[13].x, body.keypoints[13].y, body.keypoints[15].x, body.keypoints[15].y);
    line(body.keypoints[12].x, body.keypoints[12].y, body.keypoints[14].x, body.keypoints[14].y); // Right leg
    line(body.keypoints[14].x, body.keypoints[14].y, body.keypoints[16].x, body.keypoints[16].y);
    */
    // Toggle draw mode with both hands close together
    if (dist(body.keypoints[9].x, body.keypoints[9].y, body.keypoints[10].x, body.keypoints[10].y) < 20) {
      person.drawMode = !person.drawMode;
    }

    // Apply drawing mode (paint blocks or erase)
    if (person.drawMode) {
      drawBlocks(body.keypoints[9].x, body.keypoints[9].y, col);
    } else {
      eraseBlocks(body.keypoints[9].x, body.keypoints[9].y);
    }
  }
}

function bodyCheck(results) {
  bodies = results;
  let trackedIds = bodies.map(body => body.id);

  // Update lastSeen timestamp for tracked people
  for (let person of people) {
    if (trackedIds.includes(person.id)) {
      person.lastSeen = millis();  // Update last seen time
    }
  }

  // Check for people who have been missing for too long (e.g., 2000ms)
  let expirationTime = 4000;  // 2 seconds
  people = people.filter(person => millis() - person.lastSeen < expirationTime);
}

function mousePressed() {
  let randCol = random(blockColors);
  if (mouseButton === LEFT) {
    drawBlocks(mouseX, mouseY, randCol);
  }
  else {
    console.log("Click");
    eraseBlocks(mouseX, mouseY);
  }
}

function drawBlocks(xLoc, yLoc, blColor) {
  let blockDetect = false;
  for (let i = 0; i < blocks.length; i++) {
    blockDetect = blocks[i].overlaps(xLoc, yLoc, 5);
    if (blockDetect) return; // Don't add a new block if one is already there
  }
  blocks.push(new Block(xLoc, yLoc, blColor, 25));
}

function mouseDragged() {
  let randCol = random(blockColors);
  //drawBlocks(mouseX, mouseY, randCol);
}

function eraseBlocks(xLoc, yLoc) {
  for (let i = 0; i < blocks.length; i++) {
    if (blocks[i].overlaps(xLoc, yLoc, 5)) {
      blocks.splice(i, 1); // Remove the block
      console.log("block deleted");
    }
  }
}


class Block {
  constructor(posX, posY, blockCol, blockW) {
    this.x = posX;
    this.y = posY;
    this.color = blockCol;
    this.size = blockW;
  }

  display() {
    push();
    fill(this.color);
    noStroke();
    rect(this.x, this.y, this.size, this.size);
    pop();
  }

  overlaps(testX, testY, testSize) {
    let d = dist(this.x, this.y, testX, testY);
    return d < (this.size / 2 + testSize / 2); // Proper circular collision detection
  }
}

class Person {
  constructor(bodyID) {
    this.id = bodyID;
    this.color = random(blockColors);
    this.drawMode = true;
    this.lastSeen = millis();  // Track the last time they were seen
  }
}

// Helper function to find a person by ID
function findPersonById(id) {
  return people.find(person => person.id === id);
}
