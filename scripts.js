// Declared Variables - CONSTANTS
const canvas = document.getElementById("renderCanvas");
const engine = new BABYLON.Engine(canvas, true);
const updateInterval = 100; // Update every 100 milliseconds
const baseSpeed = 0.01;

// Declared Variables - LETs
let hasArrived = false; // Flag to track if the spaceship has arrived
let isPlaying = true;
let speedMultiplier = 1.0; // initial speed multiplier
let targetPosition = null;
let pickResult = null;
let currentLitPlanet = null;
let planetLight = null;
let intervalId = null;
let celestialBodies = []; // Define celestialBodies array
let moons = [];
let sun; // Declare sun globally
let baseTime = Date.now();
let lastPickedMesh = null;
let orbitMeshes = [];
let simulationSpeed = 1;

function updateSimulationSpeed(sliderValue) {
    // Map slider value (1 to 1000) to simulation speed (0.1 to 9.1)
    simulationSpeed = ((sliderValue - 1) / 999) * 9.0 + 0.1;
    updateSliderText(sliderValue);
}


//Create Artifical satelites
async function loadSatellites(scene, numSatellites = 5) {
    const satelliteUrl = "https://raw.githubusercontent.com/razvanpf/Images/main/satelite.glb"; 

    try {
        // Load the satellite model
        const satelliteModel = await BABYLON.SceneLoader.ImportMeshAsync("", satelliteUrl, "", scene);
        const satelliteMesh = satelliteModel.meshes[0];
        const satellites = [];

        // Find the Earth mesh
        const earthMesh = celestialBodies.find(body => body.data.name === "Earth").mesh;
        if (!earthMesh) {
            throw new Error("Earth mesh not found!");
        }

        for (let i = 0; i < numSatellites; i++) {
            const satelliteInstance = satelliteMesh.clone(`satellite${i}`);

            // Randomize the initial position around Earth
            const angle = Math.random() * Math.PI * 2;
            const distance = 1 + Math.random() * 0.5; // Closer to Earth
            satelliteInstance.position = new BABYLON.Vector3(
                earthMesh.position.x + distance * Math.cos(angle),
                (Math.random() - 0.5) * 0.5, // Randomize the vertical position within a small range
                earthMesh.position.z + distance * Math.sin(angle)
            );

            // Scale down the satellite to be smaller than the moon
            satelliteInstance.scaling = new BABYLON.Vector3(0.05, 0.05, 0.05); // Reduced size

            // Add emissive material to make the satellite visible
            const satelliteMaterial = new BABYLON.StandardMaterial(`satelliteMaterial${i}`, scene);
            satelliteMaterial.diffuseColor = new BABYLON.Color3(1, 1, 1); // White color
            satelliteMaterial.emissiveColor = new BABYLON.Color3(1, 1, 1); // Slight glow
            satelliteInstance.material = satelliteMaterial;

            // Add light to all child meshes of the satellite instance
            satelliteInstance.getChildMeshes().forEach((childMesh, index) => {
                const light = new BABYLON.PointLight(`light${i}_${index}`, new BABYLON.Vector3(0, 0, 0), scene);
                light.parent = childMesh; // Attach the light to the child mesh
                light.intensity = 2; // Adjust intensity as needed
                light.diffuse = new BABYLON.Color3(1, 1, 1); // White light
                light.specular = new BABYLON.Color3(1, 1, 1); // Specular color
                light.includedOnlyMeshes = [childMesh]; // Only affect this child mesh
            });

            // Add to satellites array
            satellites.push(satelliteInstance);
        }

        // Dispose of the original satellite mesh to prevent it from appearing in the scene
        satelliteMesh.dispose();

        return satellites;
    } catch (error) {
        console.error("Failed to load satellites:", error);
        return []; // Return an empty array on failure
    }
}

// Animating satellites around Earth
function animateSatellites(satellites, earthMesh) {
    if (!satellites || satellites.length === 0) {
        console.error("No satellites to animate.");
        return;
    }

    scene.registerBeforeRender(() => {
        const deltaTime = engine.getDeltaTime() * 0.001; // Default to 16ms if not defined

        satellites.forEach((satellite, index) => {
            // Calculate the angle and distance for orbit
            const distance = 2 + Math.random(); // Fixed distance for stable orbit
            const angle = (Date.now() * 0.001 + index * Math.PI / 2) % (2 * Math.PI); // Adjusted speed for faster orbit

            // Update satellite position
            satellite.position.x = earthMesh.position.x + 2 * Math.cos(angle); // Keep satellites closer to Earth
            satellite.position.z = earthMesh.position.z + 2 * Math.sin(angle); // Keep satellites closer to Earth

            // Add vertical movement for more dynamic orbits
            satellite.position.y = earthMesh.position.y + Math.sin(angle) * 0.5;
        });
    });
}

const createScene = function () {
    const scene = new BABYLON.Scene(engine);

    // Enable collision detection
    scene.collisionsEnabled = true;

    // Camera
    const camera = new BABYLON.ArcRotateCamera("camera1", Math.PI, Math.PI / 3, 150, BABYLON.Vector3.Zero(), scene);
    camera.attachControl(canvas, true);
    camera.upperRadiusLimit = 500; // Increase the zoom-out limit
    camera.lowerRadiusLimit = 1; // Allow closer zoom
    camera.lowerBetaLimit = 0; // Allow camera to go below the scene
    camera.upperBetaLimit = Math.PI; // Allow full vertical rotation
    camera.checkCollisions = true; // Enable collision detection for camera

    // Set the initial camera position (adjust these values as needed)
    camera.alpha = Math.PI * 2; // Set the horizontal angle (facing the opposite side)
    camera.beta = Math.PI / 3; // Set the vertical angle (slightly lower)
    camera.radius = 350; // Set the zoom level (slightly more zoomed in)
    camera.setTarget(BABYLON.Vector3.Zero()); // Focus on the sun

    // Adjust panning sensitivity for right mouse drag
    camera.panningSensibility = 100; // Lower value makes dragging more sensitive

    // Event listeners for right-click actions
    canvas.addEventListener("pointerdown", function (evt) {
        if (evt.button === 2) { // Right mouse button
            // Detach the camera from any attached body
            camera.setTarget(new BABYLON.Vector3(0, 0, 0));
            camera.lockedTarget = null; // Ensure locked target is detached
        }
    });

    // Ensure camera rotation and panning sensitivity
    camera.inputs.attached.pointers.angularSensibilityX = 500;
    camera.inputs.attached.pointers.angularSensibilityY = 500;

    // Add a hemispheric light for the asteroids
    const asteroidLight = new BABYLON.HemisphericLight("asteroidLight", new BABYLON.Vector3(0, -1, 0), scene);
    asteroidLight.position = new BABYLON.Vector3(0, 100, 0); // Position the light above the scene
    asteroidLight.intensity = 1.0; // Ensure intensity is adequate

    // Event listener for the speed slider to ensure simulationSpeed is being updated
    speedSlider.addEventListener("input", (event) => {
        const sliderValue = parseFloat(event.target.value);
    
        updateSimulationSpeed(sliderValue);
    });

    // updateSliderText to set the initial value
    updateSliderText(speedSlider.value);

    // Set initial simulation speed to 1.0 (normal speed)
    updateSimulationSpeed(100);

    // Create the sun with proper material and texture
    const sunTextureUrl = "https://raw.githubusercontent.com/razvanpf/Images/main/2ksun.jpg";
    sun = BABYLON.MeshBuilder.CreateSphere("sun", { diameter: 20 }, scene);
    const sunMaterial = new BABYLON.StandardMaterial("sunMaterial", scene);

    // Ensure the texture is loaded and applied
    sunMaterial.diffuseTexture = new BABYLON.Texture(sunTextureUrl, scene, false, false, BABYLON.Texture.TRILINEAR_SAMPLINGMODE, () => {
    }, (message) => {
        console.error("Failed to load sun texture:", message);
    });

    // Disable lighting and apply emissive texture
    sunMaterial.emissiveTexture = new BABYLON.Texture(sunTextureUrl, scene);
    sunMaterial.disableLighting = true;
    sun.material = sunMaterial;
    sunMaterial.backFaceCulling = false; // Ensure that the material is rendered from both sides
    sunMaterial.transparencyMode = BABYLON.Material.MATERIAL_OPAQUE; // Set transparency mode to opaque
    sun.position = new BABYLON.Vector3(0, 0, 0);
    sun.checkCollisions = true; // Enable collision detection for the sun

    //Glow Layer
    const glowLayer = new BABYLON.GlowLayer("glow", scene);
    glowLayer.intensity = 1.5; // Adjust intensity as needed
    glowLayer.addIncludedOnlyMesh(sun);

    //Create sun rays
    function createSunRays(scene, sun) {
        const sunRays = new BABYLON.VolumetricLightScatteringPostProcess('godrays', 1.0, scene.activeCamera, sun, 100, BABYLON.Texture.BILINEAR_SAMPLINGMODE, engine, false);
        sunRays.exposure = 0.3;
        sunRays.decay = 0.96815;
        sunRays.weight = 0.58767;
        sunRays.density = 0.926;
        sunRays.renderingGroupId = 0; // Ensure the rendering group ID is 0
    }

    createSunRays(scene, sun);

    // Create a point light at the sun's position
    const sunLight = new BABYLON.PointLight("sunLight", sun.position, scene);
    sunLight.intensity = 2; // Set the intensity of the light

    // ASTEROIDS //
    ///////////////

    // Asteroid belts constants
    const startButton = document.getElementById('welcomeBtn');
    const progressBar = document.getElementById('progress-bar');
    const progressText = document.getElementById('progress-text');

    let mainAsteroids = [];
    let kuiperAsteroids = [];

    // Load a model using the GLB URL
    function loadModel(url, scene, scaling = 1) {
        return new Promise((resolve, reject) => {
            BABYLON.SceneLoader.ImportMesh("", url, "", scene, function (meshes) {
                if (meshes.length > 0) {
                    let model = meshes[0];
                    model.scaling = new BABYLON.Vector3(scaling, scaling, scaling);

                    // Apply a basic material to the asteroid
                    const asteroidMaterial = new BABYLON.StandardMaterial("asteroidMaterial", scene);
                    asteroidMaterial.diffuseTexture = new BABYLON.Texture("https://raw.githubusercontent.com/razvanpf/Images/main/2k_mars.jpg", scene); // Example texture
                    asteroidMaterial.emissiveColor = new BABYLON.Color3(0.2, 0.2, 0.2); // Ensure a slight emissive color for visibility
                    asteroidMaterial.specularColor = new BABYLON.Color3(1, 1, 1); // Add specular highlights for light reflection
                    asteroidMaterial.diffuseColor = new BABYLON.Color3(0.7, 0.7, 0.7); // Ensure diffuse color is set
                    model.material = asteroidMaterial;

                    // Ensure the asteroid is visible
                    model.isVisible = true;

                    resolve(model);
                } else {
                    reject("No meshes found in the model");
                }
            }, null, function (scene, message, exception) {
                console.error("SceneLoader ImportMesh error:", message, exception);
                reject(exception || message);
            });
        });
    }

    // Create an asteroid belt
    async function createAsteroidBelt(scene, innerRadius, outerRadius, numAsteroids, yRange, progressCallback) {
        const asteroidPromises = [];
        for (let i = 0; i < numAsteroids; i++) {
            asteroidPromises.push(loadModel(asteroidUrl, scene, 0.8).finally(progressCallback)); // scaling
        }

        const asteroidModels = await Promise.all(asteroidPromises);

        const asteroids = [];
        for (let i = 0; i < asteroidModels.length; i++) {
            const asteroid = asteroidModels[i];
            const angle = Math.random() * Math.PI * 2;
            const radius = innerRadius + Math.random() * (outerRadius - innerRadius);

            asteroid.position.x = radius * Math.cos(angle);
            asteroid.position.z = radius * Math.sin(angle);
            asteroid.position.y = (Math.random() - 0.5) * yRange; // Randomize the Y position for a thicker belt

            // Randomize initial rotation
            asteroid.rotationQuaternion = new BABYLON.Quaternion.RotationYawPitchRoll(
                Math.random() * Math.PI * 2,
                Math.random() * Math.PI * 2,
                Math.random() * Math.PI * 2
            );

            // Apply a smaller random scale
            const minScale = 0.02;
            const maxScale = 0.04;
            const randomScale = minScale + Math.random() * (maxScale - minScale); // Scale between 0.02 and 0.04 for smaller asteroids
            asteroid.scaling = new BABYLON.Vector3(randomScale, randomScale, randomScale);

            // Ensure the asteroid does not cast shadows
            asteroid.receiveShadows = false;

            // Ensure the asteroid is pickable
            asteroid.isPickable = true;

            // Add action manager for hover and click actions
            asteroid.actionManager = new BABYLON.ActionManager(scene);
            asteroid.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPointerOverTrigger, () => {
                highlightAsteroidBelt(asteroid);
            }));
            asteroid.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPointerOutTrigger, () => {
                clearHighlights();
            }));
            asteroid.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPickTrigger, () => {
                showDetailsPopup(asteroid);
            }));

            // Add asteroids to the light
            const asteroidLight = scene.getLightByName("asteroidLight");
            if (asteroidLight) {
                asteroid.getChildMeshes().forEach(mesh => {
                    asteroidLight.includedOnlyMeshes.push(mesh);
                });
            }

            asteroids.push(asteroid);
        }
        return asteroids;
    }

    // Create the asteroid belt between Mars and Jupiter
    async function createMainAsteroidBelt(scene, progressCallback) {
        const innerRadius = 55;
        const outerRadius = 60; // Reduced outer radius to keep the belt between Mars and Jupiter
        const numAsteroids = 200; // Increased number of asteroids
        const yRange = 5; // Reduced thickness for a more ring-like shape

        mainAsteroids = await createAsteroidBelt(scene, innerRadius, outerRadius, numAsteroids, yRange, progressCallback);
        animateAsteroids(mainAsteroids, 0.00005); // Speed
    }

    // Create the Kuiper Belt beyond Neptune
    async function createKuiperBelt(scene, progressCallback) {
        const innerRadius = 150;
        const outerRadius = 180; // Outer radius
        const numAsteroids = 300; // Number of asteroids
        const yRange = 5; // For thickness

        kuiperAsteroids = await createAsteroidBelt(scene, innerRadius, outerRadius, numAsteroids, yRange, progressCallback);
        animateAsteroids(kuiperAsteroids, 0.00001); // Adjust speed as necessary
    }

    // FAnimate asteroids orbiting around the sun
    function animateAsteroids(asteroids, speed) {
        scene.registerBeforeRender(() => {
            const deltaTime = engine.getDeltaTime() * speed * simulationSpeed; // Speed adjustment with simulation speed
            asteroids.forEach(asteroid => {
                const radius = Math.sqrt(asteroid.position.x ** 2 + asteroid.position.z ** 2);
                const angle = Math.atan2(asteroid.position.z, asteroid.position.x) + deltaTime; // Change - deltaTime to + deltaTime for counter-clockwise rotation

                asteroid.position.x = radius * Math.cos(angle);
                asteroid.position.z = radius * Math.sin(angle);
            });
        });
    }

    // Update the progress bar
    function updateProgressBar(progress) {
        progressBar.style.width = `${progress}%`;
        progressBar.textContent = `${Math.round(progress)}%`;
        if (progress >= 100) {
            progressText.textContent = "Complete!";
        }
    }

    // Create the asteroid belts and update the progress bar
    async function createAsteroidBelts(scene) {
        const totalAsteroids = 500; // Total number of asteroids in both belts !IMPORTANT FOR LOADING PROGRESS BAR TIME, ADJUST IF ASTEROID NUMBERS WERE CHANGED!!!
        let loadedAsteroids = 0;

        const progressCallback = () => {
            loadedAsteroids++;
            const progress = (loadedAsteroids / totalAsteroids) * 100;
            updateProgressBar(progress);
        };

        await createMainAsteroidBelt(scene, progressCallback);
        await createKuiperBelt(scene, progressCallback);

        startButton.disabled = false; // Enable the button once loading is complete
        startButton.style.backgroundColor = ''; // Reset the button style
        startButton.style.color = ''; // Reset the text color
        startButton.style.cursor = ''; // Reset the cursor
    }

    // Create asteroid belts
    createAsteroidBelts(scene).then(() => {
    }).catch((error) => {
        console.error("Failed to create asteroid belts:", error);
    });

    // Event listener for the start button
    startButton.addEventListener('click', () => {
        document.getElementById('welcomePopup').style.display = 'none';
        document.getElementById('renderCanvas').classList.remove('blur');
    });


    // Add an invisible mesh around the Sun to extend the clickable area
    const invisibleSun = BABYLON.MeshBuilder.CreateSphere("invisibleSun", { diameter: 21 }, scene); // diameter
    invisibleSun.visibility = 0; // Make it invisible
    invisibleSun.position = sun.position; // Ensure it is at the same position as the sun

    // Add action managers to the invisibleSun for interaction
    invisibleSun.actionManager = new BABYLON.ActionManager(scene);
    invisibleSun.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPointerOverTrigger, function () {
        sun.renderOutline = true;
        sun.outlineWidth = 0.1;
        sun.outlineColor = BABYLON.Color3.White();
    }));
    invisibleSun.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPointerOutTrigger, function () {
        sun.renderOutline = false;
    }));
    invisibleSun.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPickTrigger, function () {
        moveToTarget(sun.position, () => {
            camera.setTarget(sun.position);
            showPopup(sun);
        });
    }));

    // Move the ship to the target position
    function moveToTarget(targetPos, arrivalCallback) {
        targetPosition = targetPos.clone(); // Clone to avoid modifying the original target position
        onArrivalCallback = arrivalCallback;
        scene.registerBeforeRender(moveShip);
    }

    // Move the ship to the target position 2
    function moveShip() {
        if (targetPosition) {
            const direction = targetPosition.subtract(spaceship.position).normalize();
            const baseSpeed = 0.4; // Base speed of the ship
            const adjustedSpeed = simulationSpeed > 1 ? baseSpeed * (1 + ((simulationSpeed - 1) / (9.1 - 1)) * (2.3 - 1)) : baseSpeed; // Adjust the speed only if simulation speed is above 1

            spaceship.moveWithCollisions(direction.scale(adjustedSpeed)); // Adjust the speed as needed

            // Use a precise distance check for arrival
            const arrivalThreshold = 0.5; //threshold 
            if (BABYLON.Vector3.Distance(spaceship.position, targetPosition) < arrivalThreshold) {
                scene.unregisterBeforeRender(moveShip); // Stop moving the ship
                targetPosition = null;
                hasArrived = true; // Set the flag to indicate arrival
                particleSystem.stop();

                // Trigger the onArrival callback immediately
                if (onArrivalCallback) {
                    onArrivalCallback();
                    onArrivalCallback = null; // Clear the callback to avoid repeated calls
                }
            }
        }
    }

    // Sun Rotation
    scene.registerBeforeRender(() => {
        sun.rotation.y -= baseSpeed * simulationSpeed * 0.1;
    });


    // Create and configure celestial bodies, planets, and moons
    const celestialData = [
        {
            name: "Mercury",
            texture: "https://raw.githubusercontent.com/razvanpf/Images/main/2k_mercury.jpg",
            size: 1,
            distance: 20,
            orbitSpeed: 0.0001,
            rotationSpeed: 0.02, 
            moons: [],
            type: "planet" 
        },
        {
            name: "Venus",
            texture: "https://raw.githubusercontent.com/razvanpf/Images/main/2k_venus_atmosphere.jpg",
            size: 1.2,
            distance: 30,
            orbitSpeed: 0.0002,
            rotationSpeed: 0.02, 
            moons: [],
            type: "planet" 
        },
        {
            name: "Earth",
            texture: "https://raw.githubusercontent.com/razvanpf/Images/main/2kearth.jpg",
            size: 1.3,
            distance: 40,
            orbitSpeed: 0.00015,
            rotationSpeed: 0.4, 
            moons: [
                { name: "Moon", size: 0.3, distance: 3, orbitSpeed: 0.4, rotationSpeed: 0.4, texture: "https://raw.githubusercontent.com/razvanpf/Images/main/Moon3D.jpg", type: "moon" } 
            ],
            type: "planet" 
        },
        {
            name: "Mars",
            texture: "https://raw.githubusercontent.com/razvanpf/Images/main/2k_mars.jpg",
            size: 1.1,
            distance: 50,
            orbitSpeed: 0.0001,
            rotationSpeed: 0.2, 
            moons: [
                { name: "Phobos", size: 0.1, distance: 2, orbitSpeed: 0.5, rotationSpeed: 0.4, texture: "https://raw.githubusercontent.com/razvanpf/Images/main/Phobos3D.jpg", type: "moon" }, 
                { name: "Deimos", size: 0.1, distance: 3, orbitSpeed: 0.4, rotationSpeed: 0.4, texture: "https://raw.githubusercontent.com/razvanpf/Images/main/Deimos3D.jpg", type: "moon" } 
            ],
            type: "planet" 
        },
        {
            name: "Jupiter",
            texture: "https://raw.githubusercontent.com/razvanpf/Images/main/2k_jupiter.jpg",
            size: 2.8,
            distance: 70,
            orbitSpeed: 0.0001,
            rotationSpeed: 0.1, 
            moons: [
                { name: "Io", size: 0.3, distance: 4, orbitSpeed: 0.5, rotationSpeed: 0.4, texture: "https://raw.githubusercontent.com/razvanpf/Images/main/IO3D.jpg", type: "moon" }, 
                { name: "Europa", size: 0.3, distance: 5, orbitSpeed: 0.6, rotationSpeed: 0.4, texture: "https://raw.githubusercontent.com/razvanpf/Images/main/Europa3D.jpg", type: "moon" },
                { name: "Ganymede", size: 0.3, distance: 6, orbitSpeed: 0.45, rotationSpeed: 0.4, texture: "https://raw.githubusercontent.com/razvanpf/Images/main/Ganymede.jpg", type: "moon" }, 
                { name: "Callisto", size: 0.3, distance: 7, orbitSpeed: 0.6, rotationSpeed: 0.4, texture: "https://raw.githubusercontent.com/razvanpf/Images/main/Callisto3D.jpg", type: "moon" } 
            ],
            type: "planet" 
        },
        {
            name: "Saturn",
            texture: "https://raw.githubusercontent.com/razvanpf/Images/main/2k_saturn.jpg",
            size: 2.2,
            distance: 90,
            orbitSpeed: 0.00005,
            rotationSpeed: 0.2, 
            moons: [
                { name: "Titan", size: 0.4, distance: 6, orbitSpeed: 0.4, rotationSpeed: 0.4, texture: "https://raw.githubusercontent.com/razvanpf/Images/main/Titan3D.jpg", type: "moon" } 
            ],
            type: "planet" 
        },
        {
            name: "Uranus",
            texture: "https://raw.githubusercontent.com/razvanpf/Images/main/2k_uranus.jpg",
            size: 2,
            distance: 110,
            orbitSpeed: 0.00005,
            rotationSpeed: 0.2, 
            moons: [
                { name: "Titania", size: 0.4, distance: 5, orbitSpeed: 0.4, rotationSpeed: 0.4, texture: "https://raw.githubusercontent.com/razvanpf/Images/main/Titania3D.jpg", type: "moon" }, 
                { name: "Oberon", size: 0.4, distance: 7, orbitSpeed: 0.6, rotationSpeed: 0.4, texture: "https://raw.githubusercontent.com/razvanpf/Images/main/Oberon3Dv2.jpg", type: "moon" }, 
                { name: "Miranda", size: 0.3, distance: 4, orbitSpeed: 0.5, rotationSpeed: 0.4, texture: "https://raw.githubusercontent.com/razvanpf/Images/main/Miranda3D.jpg", type: "moon" } 
            ],
            type: "planet" 
        },
        {
            name: "Neptune",
            texture: "https://raw.githubusercontent.com/razvanpf/Images/main/2kneptune.jpg",
            size: 1.9,
            distance: 130,
            orbitSpeed: 0.000025,
            rotationSpeed: 0.2,
            moons: [
                { name: "Triton", size: 0.4, distance: 5, orbitSpeed: 0.4, rotationSpeed: 0.4, texture: "https://raw.githubusercontent.com/razvanpf/Images/main/Triton3D.jpg", type: "moon" } 
            ],
            type: "planet" 
        },
        // Dwarf Planets
        {
            name: "Ceres",
            texture: "https://raw.githubusercontent.com/razvanpf/Images/main/2k_ceres.jpg",
            size: 0.8,
            distance: 35,
            orbitSpeed: 0.0002,
            rotationSpeed: 0.2,
            inclination: 10,
            eccentricity: 0.08,
            moons: [],
            type: "dwarfPlanet" 
        },
        {
            name: "Pluto",
            texture: "https://raw.githubusercontent.com/razvanpf/Images/main/2k_pluto.jpg",
            size: 0.9,
            distance: 160,
            orbitSpeed: 0.000025,
            rotationSpeed: 0.2,
            inclination: 17, 
            eccentricity: 0.25,
            moons: [
                { name: "Charon", size: 0.45, distance: 3, orbitSpeed: 0.4, rotationSpeed: 0.4, texture: "https://raw.githubusercontent.com/razvanpf/Images/main/Charon3D.jpg", type: "moon" }
            ],
            type: "dwarfPlanet" 
        },
        {
            name: "Haumea",
            texture: "https://raw.githubusercontent.com/razvanpf/Images/main/2k_haumea.jpg",
            size: 0.8,
            distance: 200,
            orbitSpeed: 0.000025,
            rotationSpeed: 0.2,
            inclination: 28,
            eccentricity: 0.19,
            moons: [],
            type: "dwarfPlanet" 
        },
        {
            name: "Makemake",
            texture: "https://raw.githubusercontent.com/razvanpf/Images/main/2k_makemake.jpg",
            size: 0.8,
            distance: 210,
            orbitSpeed: 0.000025,
            rotationSpeed: 0.2,
            inclination: 29,
            eccentricity: 0.16,
            moons: [],
            type: "dwarfPlanet" 
        },
        {
            name: "Eris",
            texture: "https://raw.githubusercontent.com/razvanpf/Images/main/2k_Eris.jpg",
            size: 0.8,
            distance: 230,
            orbitSpeed: 0.000025,
            rotationSpeed: 0.2,
            inclination: 44,
            eccentricity: 0.44,
            moons: [],
            type: "dwarfPlanet"
        },
    
    ];
    
    const createRings = (scene) => {
        celestialData.forEach((data, index) => {
            let orbit;
            if (data.name === "Ceres" || data.name === "Pluto" || data.name === "Haumea" || data.name === "Makemake" || data.name === "Eris") {
                const path3D = createOrbitPath(data.distance, data.eccentricity, data.inclination, scene);
                orbit = BABYLON.MeshBuilder.CreateTube(`orbit${index}`, { path: path3D.getPoints(), radius: 0.05, tessellation: 64 }, scene);
            } else {
                // Create regular circular orbit for other planets
                orbit = BABYLON.MeshBuilder.CreateTorus(`orbit${index}`, { diameter: data.distance * 2, thickness: 0.05, tessellation: 128 }, scene);
            }
            const orbitMaterial = new BABYLON.StandardMaterial(`orbitMaterial${index}`, scene);
            orbitMaterial.diffuseColor = new BABYLON.Color3(1, 1, 1);
            orbitMaterial.emissiveColor = new BABYLON.Color3(1, 1, 1);
            orbitMaterial.alpha = 0.5; // Set the opacity to 50%
            orbit.material = orbitMaterial;
    
            orbitMeshes.push(orbit); // Store the orbit mesh
        });
    };

    // Toggle visibility of orbits
const toggleOrbitsVisibility = () => {
    const hideOrbitsCheckbox = document.getElementById("hideOrbitsCheckbox");
    hideOrbitsCheckbox.addEventListener("change", function () {
        const isChecked = hideOrbitsCheckbox.checked;
        orbitMeshes.forEach(orbit => {
            orbit.isVisible = !isChecked;
        });
    });
};
    
    // Create the 3D path for an inclined and eccentric orbit
    function createOrbitPath(distance, eccentricity, inclination, scene) {
        const points = [];
        const numPoints = 128;
        for (let i = 0; i <= numPoints; i++) {
            const angle = 2 * Math.PI * (i / numPoints);
            const r = distance * (1 - eccentricity ** 2) / (1 + eccentricity * Math.cos(angle));
            const x = r * Math.cos(angle);
            const y = r * Math.sin(angle) * Math.sin(BABYLON.Tools.ToRadians(inclination));
            const z = r * Math.sin(angle) * Math.cos(BABYLON.Tools.ToRadians(inclination));
            points.push(new BABYLON.Vector3(x, y, z));
        }
        return new BABYLON.Path3D(points);
    }
    

    celestialData.forEach((data, index) => {
        // Create planet
        const planet = BABYLON.MeshBuilder.CreateSphere(`planet${index}`, { diameter: data.size * 2 }, scene);
        const planetMaterial = new BABYLON.StandardMaterial(`planetMaterial${index}`, scene);
        planetMaterial.diffuseTexture = new BABYLON.Texture(data.texture, scene);
        planet.material = planetMaterial;
        planetMaterial.specularColor = new BABYLON.Color3(0, 0, 0);
        planet.position = new BABYLON.Vector3(data.distance, 0, 0);
    
        // Set initial position of the planet
        planet.position = new BABYLON.Vector3(data.distance, 0, 0);
        celestialBodies.push({ mesh: planet, data, angle: 0 });
    
        // Flip the planet upside down
        planet.rotation.x = Math.PI; // Flipping the planet
    
        // Create rings around Saturn
        const createSaturnRings = (scene, planet) => {
            const ringSettings = [
                { innerDiameter: planet.scaling.x * 6, outerDiameter: planet.scaling.x * 6.8, opacity: 0.4, tessellation: 128 },
                { innerDiameter: planet.scaling.x * 6.8, outerDiameter: planet.scaling.x * 7.5, opacity: 0.3, tessellation: 128 },
                { innerDiameter: planet.scaling.x * 8, outerDiameter: planet.scaling.x * 9, opacity: 0.3, tessellation: 128 }
            ];
        
            ringSettings.forEach((settings, index) => {
                const ring = BABYLON.MeshBuilder.CreateDisc(`ring_${index}`, {
                    radius: settings.outerDiameter / 2,
                    tessellation: settings.tessellation,
                    sideOrientation: BABYLON.Mesh.DOUBLESIDE
                }, scene);
        
                ring.scaling.x = settings.outerDiameter / settings.innerDiameter;
        
                const ringMaterial = new BABYLON.StandardMaterial(`ringMaterial_${index}`, scene);
                ringMaterial.diffuseTexture = new BABYLON.Texture("https://raw.githubusercontent.com/razvanpf/Images/main/SaturnRingsCircle.png", scene);
                ringMaterial.diffuseTexture.hasAlpha = true; // Enable transparency in texture
                ringMaterial.backFaceCulling = false; // Ensure both sides are rendered
                ringMaterial.alpha = settings.opacity;
                ringMaterial.emissiveColor = new BABYLON.Color3(1, 1, 1); // Make the ring visible
                ring.material = ringMaterial;
    
                // Rotate the ring to be horizontal and position it correctly
                ring.rotation.x = Math.PI / 2; 
                ring.rotation.z = Math.PI; // Flip the ring upside down
                ring.position.y = planet.position.y; // Align with the planet's position
    
                ring.parent = planet; // Attach the ring to Saturn
            });
        };
    
        // After creating all celestial bodies
        celestialBodies.forEach((body) => {
            if (body.data.name === "Saturn") {
                createSaturnRings(scene, body.mesh);
            }
        });

    // Initialize the lens flare effect for dwarf planets
    addLensFlareEffectsToDwarfPlanets(scene);

// Event listener for the checkbox to enable/disable flashing
document.getElementById("disableFlashingCheckbox").addEventListener("change", function () {
    const isChecked = this.checked;
    celestialBodies.forEach(body => {
        if (body.data.name === "Ceres" || body.data.name === "Pluto" || body.data.name === "Haumea" || body.data.name === "Makemake" || body.data.name === "Eris") {
            if (isChecked) {
                stopLensFlareEffect(body.mesh);
            } else {
                if (!body.visited) {  // NOT WORKING FOR SOME REASON, should disable highlight effect on visited dwarf planets.
                    createLensFlareEffect(scene, body.mesh);
                }
            }
        }
    });

    // Voyager lens flare control
    const voyager = scene.getMeshByName("Voyager");
    if (voyager) {
        if (isChecked) {
            stopVoyagerLensFlareEffect(voyager);
        } else {
            createVoyagerLensFlareEffect(scene, voyager);
        }
    }
});
    
        // Add outline on hover for planets
        planet.actionManager = new BABYLON.ActionManager(scene);
        planet.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPointerOverTrigger, function () {
            planet.renderOutline = true;
            planet.outlineWidth = 0.1;
            planet.outlineColor = BABYLON.Color3.White();
        }));
        planet.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPointerOutTrigger, function () {
            planet.renderOutline = false;
        }));
    
        data.moons.forEach((moonData, moonIndex) => {
            const moon = BABYLON.MeshBuilder.CreateSphere(`moon${index}_${moonIndex}`, { diameter: moonData.size * 2 }, scene);
            const moonMaterial = new BABYLON.StandardMaterial(`moonMaterial${index}_${moonIndex}`, scene);
            moonMaterial.diffuseTexture = new BABYLON.Texture(moonData.texture, scene);
            moon.material = moonMaterial;
            moonMaterial.specularColor = new BABYLON.Color3(0, 0, 0); // Reduce reflectivity
            moon.position = new BABYLON.Vector3(planet.position.x + moonData.distance, 0, planet.position.z);
            moons.push({ mesh: moon, data: moonData, parent: planet, angle: Math.random() * Math.PI * 2 }); // Initialize with random angle
    
            // Set initial position of the moon
            moon.position = new BABYLON.Vector3(
                planet.position.x + moonData.distance * Math.cos(moon.angle),
                0,
                planet.position.z + moonData.distance * Math.sin(moon.angle)
            );
    
            // Add outline on hover for moons
            moon.actionManager = new BABYLON.ActionManager(scene);
            moon.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPointerOverTrigger, function () {
                moon.renderOutline = true;
                moon.outlineWidth = 0.1;
                moon.outlineColor = BABYLON.Color3.White();
            }));
            moon.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPointerOutTrigger, function () {
                moon.renderOutline = false;
            }));
        });
    });
    
    // Initialize angle property for celestial bodies and moons
    celestialBodies.forEach((body) => {
        body.angle = 0;
    });
    
    // Animate planets and moons
    scene.registerBeforeRender(function () {
        const deltaTime = engine.getDeltaTime() * 0.001; // Default to 16ms if not defined
    
        celestialBodies.forEach((body) => {
            if (body.data.name === "Ceres" || body.data.name === "Pluto" || body.data.name === "Haumea" || body.data.name === "Makemake" || body.data.name === "Eris") {
                const distance = body.data.distance;
                const inclination = BABYLON.Tools.ToRadians(body.data.inclination);
                const eccentricity = body.data.eccentricity;
                const angle = (Date.now() * body.data.orbitSpeed * speedMultiplier * simulationSpeed) % (2 * Math.PI);
                const r = distance * (1 - eccentricity ** 2) / (1 + eccentricity * Math.cos(angle));
                body.mesh.position.x = r * Math.cos(angle);
                body.mesh.position.y = r * Math.sin(angle) * Math.sin(inclination);
                body.mesh.position.z = r * Math.sin(angle) * Math.cos(inclination);
            } else {
                const distance = body.data.distance;
                const angle = (Date.now() * body.data.orbitSpeed * speedMultiplier * simulationSpeed) % (2 * Math.PI);
                body.mesh.position.x = distance * Math.cos(angle);
                body.mesh.position.z = distance * Math.sin(angle);
            }
    
            // Rotation around own axis
            if (body.data.name === "Venus") {
                body.mesh.rotation.y += body.data.rotationSpeed * simulationSpeed * 0.01; // Clockwise rotation
            } else if (body.data.name === "Uranus") {
                body.mesh.rotation.z += body.data.rotationSpeed * simulationSpeed * 0.01; // Rolling rotation
            } else {
                body.mesh.rotation.y -= body.data.rotationSpeed * simulationSpeed * 0.01; // Counter-clockwise rotation
            }
        });
    
        // Animate moons around their planets
        moons.forEach((moon) => {
            const distance = moon.data.distance;
            
            // Check if the moon is Triton to reverse its orbit direction
            if (moon.data.name === "Triton") {
                moon.angle -= moon.data.orbitSpeed * simulationSpeed * deltaTime; // Reverse direction for Triton
            } else {
                moon.angle += moon.data.orbitSpeed * simulationSpeed * deltaTime; // Normal direction for other moons
            }
        
            // Update moon position
            moon.mesh.position.x = moon.parent.position.x + distance * Math.cos(moon.angle);
            moon.mesh.position.z = moon.parent.position.z + distance * Math.sin(moon.angle);
            moon.mesh.position.y = moon.parent.position.y; // Keep the moon on the same horizontal plane
        
            // Rotation around own axis
            moon.mesh.rotation.y -= moon.data.rotationSpeed * simulationSpeed * 0.01; // Counter-clockwise rotation
        
            // Ensure specific moons always face the parent planet (tidal locking)
            const tidallyLockedMoons = ["Moon", "Oberon", "Miranda", "Triton", "Titania", "Charon"];
            if (tidallyLockedMoons.includes(moon.data.name)) {
                moon.mesh.lookAt(moon.parent.position);
            } else {
                // Normal rotation for other moons
                moon.mesh.rotation.y -= moon.data.rotationSpeed * simulationSpeed * 0.01; // Counter-clockwise rotation
            }
        });
    });
    
    // Spaceship
    let spaceship;
    let particleSystem; 
    
    BABYLON.SceneLoader.ImportMesh("", "https://models.babylonjs.com/", "ufo.glb", scene, function (meshes) {
        spaceship = meshes[0];
        spaceship.scaling = new BABYLON.Vector3(1, 1, 1); // Slightly bigger
        spaceship.position = new BABYLON.Vector3(0, -15, 0);
        // Set the initial position of the spaceship
        const initialX = 15; // Move it to the left of the sun
        const initialY = 0;    // Align with the orbit plane
        const initialZ = 0;    // Same plane as the orbit rings
        spaceship.checkCollisions = true; // Enable collision detection for the spaceship
        spaceship.ellipsoid = new BABYLON.Vector3(1, 1, 1);
        spaceship.ellipsoidOffset = new BABYLON.Vector3(0, 1, 0);
    
        spaceship.position = new BABYLON.Vector3(initialX, initialY, initialZ);
    
        // Fiery Trail
        particleSystem = new BABYLON.ParticleSystem("particles", 2000, scene);
        particleSystem.particleTexture = new BABYLON.Texture("https://assets.babylonjs.com/textures/flare.png", scene);
        particleSystem.emitter = spaceship;
        particleSystem.minEmitBox = new BABYLON.Vector3(-0.5, 0, -0.5);
        particleSystem.maxEmitBox = new BABYLON.Vector3(0.5, 0, 0.5);

        particleSystem.color1 = new BABYLON.Color4(1, 0.5, 0, 1.0);
        particleSystem.color2 = new BABYLON.Color4(1, 0, 0, 1.0);
        particleSystem.colorDead = new BABYLON.Color4(0, 0, 0, 0.0);
    
        particleSystem.minSize = 0.1;
        particleSystem.maxSize = 0.5;
    
        particleSystem.minLifeTime = 0.3;
        particleSystem.maxLifeTime = 1.5;
    
        particleSystem.emitRate = 500;
    
        particleSystem.blendMode = BABYLON.ParticleSystem.BLENDMODE_ONEONE;
    
        particleSystem.gravity = new BABYLON.Vector3(0, 0, 0);
    
        particleSystem.direction1 = new BABYLON.Vector3(-1, -1, -1);
        particleSystem.direction2 = new BABYLON.Vector3(1, -1, 1);
    
        particleSystem.minAngularSpeed = 0;
        particleSystem.maxAngularSpeed = Math.PI;
    
        particleSystem.minEmitPower = 1;
        particleSystem.maxEmitPower = 3;
        particleSystem.updateSpeed = 0.005;
    
        particleSystem.start();
    
        // Apply emissive material to spaceship and child meshes
        spaceship.getChildMeshes().forEach(mesh => {
            // Adjust the material
            const shipMaterial = new BABYLON.StandardMaterial("shipMaterial", scene);
            shipMaterial.emissiveColor = new BABYLON.Color3(0, 0, 1); // Emissive color to make it stand out
            mesh.material = shipMaterial;
    
            // Apply outline
            mesh.renderOutline = true;
            mesh.outlineWidth = 0.1;
            mesh.outlineColor = BABYLON.Color3.Blue(); // Set the outline color to blue
        });
    
        // Event listener for canvas click
        let isDragging = false;
        let mouseDown = false;
        let lastPickedMesh = null; // Store the last picked mesh
    
        canvas.addEventListener("mousedown", function (evt) {
            mouseDown = true;
            isDragging = false;
        });
    
        canvas.addEventListener("mousemove", function (evt) {
            if (mouseDown) {
                isDragging = true;
            }
        });
    
        canvas.addEventListener("mouseup", function (evt) {
            mouseDown = false;
            if (!isDragging) {
                handleCanvasClick(evt);
            }
            isDragging = false;
        });
    
        function handleCanvasClick(evt) {
            pickResult = scene.pick(evt.clientX, evt.clientY);
            if (pickResult.hit && pickResult.pickedMesh) {
                targetPosition = pickResult.pickedPoint;
                spaceship.lookAt(targetPosition);
                particleSystem.start();
        
                // Detach the ship from the planet when a new target is selected
                detachShipFromPlanet(spaceship);
        
                // Reset the hasArrived flag
                hasArrived = false;
        
                // Check if the target is a planet, moon, sun, or Voyager
                if (pickResult.pickedMesh.name.startsWith("planet") || pickResult.pickedMesh.name.startsWith("moon") || pickResult.pickedMesh.name === "sun" || pickResult.pickedMesh.name === "Voyager") {
                    lastPickedMesh = pickResult.pickedMesh; // Store the last picked mesh
                    startUpdatingTargetPosition(pickResult.pickedMesh);
                } else {
                    lastPickedMesh = null; // Clear last picked mesh for unrecognized bodies
                    stopUpdatingTargetPosition();
                }
            }
        }
    
        // Click event that ensures that handleCanvasClick is only called if there was no dragging
        canvas.addEventListener("click", function (evt) {
            if (!isDragging) {
                handleCanvasClick(evt);
            }
        });
    
        // Handle arrival and trigger popup
        function onArrival() {
            if (lastPickedMesh) {
                camera.setTarget(lastPickedMesh.position);
                showPopup(lastPickedMesh);
                lastPickedMesh = null; // Clear the last picked mesh after triggering the popup
            }
        }
    
        // Update moveToTarget function to use onArrival callback
        //function moveToTarget(targetPos, arrivalCallback) {
           // targetPosition = targetPos.clone(); // Clone to avoid modifying the original target position
           // onArrivalCallback = arrivalCallback;
           // scene.registerBeforeRender(moveShip);
        //}
        // Attach ship function that should disable blinking effect
        function attachShipToPlanet(ship, planet) {
            ship.parent = planet;
            ship.position = BABYLON.Vector3.Zero();
            planet.visited = true; // Mark the planet as visited
        }

    
        // Detach ship function
        function detachShipFromPlanet(ship) {
            if (ship.parent) {
                const worldMatrix = ship.getWorldMatrix();
                const worldPosition = BABYLON.Vector3.TransformCoordinates(BABYLON.Vector3.Zero(), worldMatrix);
                ship.parent = null;
                ship.position = worldPosition;
            }
        }
    
        // Handle spaceship movement and camera focus
        scene.registerBeforeRender(function () {
            if (targetPosition) {
                const direction = targetPosition.subtract(spaceship.position).normalize();
                const baseSpeed = 0.4; // Base speed of the ship
                const adjustedSpeed = simulationSpeed > 1 ? baseSpeed * (1 + ((simulationSpeed - 1) / (9.1 - 1)) * (2.3 - 1)) : baseSpeed; // Adjust the speed only if simulation speed is above 1
        
                spaceship.moveWithCollisions(direction.scale(adjustedSpeed)); // speed adjustment
        
                // Use a precise distance check for arrival
                const arrivalThreshold = 0.5; //threshold
                if (BABYLON.Vector3.Distance(spaceship.position, targetPosition) < arrivalThreshold && !hasArrived) {
                    scene.unregisterBeforeRender(moveShip); // Stop moving the ship
                    targetPosition = null;
                    hasArrived = true; // Set the flag to indicate arrival
                    if (particleSystem) {
                        particleSystem.stop();
                    }
                    if (lastPickedMesh) {
                        if (lastPickedMesh.name.startsWith("planet") || lastPickedMesh.name.startsWith("moon") || lastPickedMesh.name === "sun" || lastPickedMesh.name === "Voyager") {
                            attachShipToPlanet(spaceship, lastPickedMesh);
                            setTimeout(() => {
                                camera.setTarget(lastPickedMesh.position); // Set camera focus to the target
                                lightUpPlanet(lastPickedMesh); // Light up the target
                                showPopup(lastPickedMesh);
                            }, 1000); // Add a delay before focusing on the target
                        }
                    } else {
                        // Reset camera to sun if empty space is clicked - NOT really working, should remove in future updates
                        camera.setTarget(BABYLON.Vector3.Zero());
                        if (planetLight) {
                            planetLight.dispose();
                            planetLight = null;
                            currentLitPlanet = null;
                        }
                    }
                }
            }
        });
    });
    
    // Background
    scene.clearColor = new BABYLON.Color3(0, 0, 0);
    
// Twinkling Stars
const starParticles = new BABYLON.ParticleSystem("stars", 5000, scene);
starParticles.particleTexture = new BABYLON.Texture("https://assets.babylonjs.com/textures/flare.png", scene);
starParticles.emitter = new BABYLON.Vector3(0, 0, 0);

// Define the boundaries of the scene
const innerBoundary = 400; // Distance from the center where stars should not spawn
const outerBoundary = 500; // Distance from the center where stars can spawn

// Custom particle emitter function to control particle positions
starParticles.startPositionFunction = function(worldMatrix, positionToUpdate) {
    let distanceFromCenter;
    do {
        // Random position within the outer boundaries
        positionToUpdate.x = Math.random() * 2 * outerBoundary - outerBoundary;
        positionToUpdate.y = Math.random() * 2 * outerBoundary - outerBoundary;
        positionToUpdate.z = Math.random() * 2 * outerBoundary - outerBoundary;

        // Calculate distance from the center of the scene
        distanceFromCenter = Math.sqrt(
            positionToUpdate.x * positionToUpdate.x +
            positionToUpdate.y * positionToUpdate.y +
            positionToUpdate.z * positionToUpdate.z
        );
    } while (distanceFromCenter < innerBoundary || distanceFromCenter > outerBoundary); // Ensure the position is within the specified range
};

starParticles.color1 = new BABYLON.Color4(4, 4, 4, 1.0);
starParticles.color2 = new BABYLON.Color4(3.4, 3.4, 4, 1.0);
starParticles.colorDead = new BABYLON.Color4(0, 0, 0, 0.0);

starParticles.minSize = 0.1;
starParticles.maxSize = 0.5;

starParticles.minLifeTime = Number.MAX_SAFE_INTEGER; // Infinite life time
starParticles.maxLifeTime = Number.MAX_SAFE_INTEGER;

starParticles.emitRate = 10000;

starParticles.blendMode = BABYLON.ParticleSystem.BLENDMODE_ONEONE;

starParticles.gravity = new BABYLON.Vector3(0, 0, 0);

starParticles.direction1 = new BABYLON.Vector3(0, 0, 0);
starParticles.direction2 = new BABYLON.Vector3(0, 0, 0);

starParticles.updateSpeed = 0.005;

starParticles.start();

// Lighting up planets on visit
    
    function lightUpPlanet(planet) {
        if (currentLitPlanet && planetLight) {
            planetLight.dispose();
            planetLight = null;
        }
    
        // Create a new hemispheric light for the visited planet
        planetLight = new BABYLON.HemisphericLight(`planetLight_${planet.name}`, new BABYLON.Vector3(0, 1, 0), scene);
        planetLight.intensity = 1.5;
        planetLight.parent = planet;
    
        // Ensure the light affects the visited planet
        planetLight.includedOnlyMeshes = [planet];
    
        // Update the current lit planet
        currentLitPlanet = planet;
    }
    
    function showPopup(mesh) {
        const popup = document.getElementById("popup");
        popup.style.display = "block";
    
        const planetDescriptions = {
            "Mercury": {
                name: "Mercury",
                description: "The smallest planet in this star system and closest to the star Sol. From its surface, the star would appear more than three times as large as it does from the third planet. The intense sunlight could almost vaporize an alien.",
                image: "https://raw.githubusercontent.com/razvanpf/Images/main/2D%20Solar%20System%20Textures/Mercury2d.png"
            },
            "Venus": {
                name: "Venus",
                description: "Second planet from Sol, and the sixth largest. The hottest planet here, named for a deity of Earth's inhabitants. It appears as a twin to the third planet but is a true furnace beneath its cloud cover. Approach with caution!",
                image: "https://raw.githubusercontent.com/razvanpf/Images/main/2D%20Solar%20System%20Textures/Venus2d.png"
            },
            "Earth": {
                name: "Earth",
                description: "Rounded into an ellipsoid, this planet is the densest in the system and teeming with life forms. It's roughly eight light-minutes away from the star and completes one orbit in what Earthlings call a year. First contact prospects: promising.",
                image: "https://raw.githubusercontent.com/razvanpf/Images/main/2D%20Solar%20System%20Textures/Earth2d.png"
            },
            "Mars": {
                name: "Mars",
                description: "Dry, rocky, and cold. The fourth planet from Sol and one of the closest neighbors to Earth. Easily spotted in the night sky, it glows a bright red. Earthlings are actively trying to make it habitable. Competition for territory imminent?",
                image: "https://raw.githubusercontent.com/razvanpf/Images/main/2D%20Solar%20System%20Textures/Mars2d.png"
            },
            "Jupiter": {
                name: "Jupiter",
                description: "A world of extremes and the largest planet here. If it were a hollow shell, 1,000 Earths could fit inside. Formed from the primordial dust and gases left over from the star's creation. Note: avoid storms.",
                image: "https://raw.githubusercontent.com/razvanpf/Images/main/2D%20Solar%20System%20Textures/jupiter2d.png"
            },
            "Saturn": {
                name: "Saturn",
                description: "The sixth planet from Sol and the second largest. Known for its spectacular rings made of ice and rock. Not unique in having rings, but definitely the most stylish. Warning: Rings not suitable for extraterrestrial jewelry",
                image: "https://raw.githubusercontent.com/razvanpf/Images/main/2D%20Solar%20System%20Textures/Saturn2dv2.png"
            },
            "Uranus": {
                name: "Uranus",
                description: "A very cold and windy world. This ice giant rotates almost on its side, making it appear to roll around Sol. Surrounded by faint rings and small moons. Possible site for extreme sports?",
                image: "https://raw.githubusercontent.com/razvanpf/Images/main/2D%20Solar%20System%20Textures/Uranus2d.png"
            },
            "Neptune": {
                name: "Neptune",
                description: "One of the outer system's ice giants. Composed mostly of water, methane, and ammonia over a rocky core. The densest of the giant planets. Resources extraction potential: high.",
                image: "https://raw.githubusercontent.com/razvanpf/Images/main/2D%20Solar%20System%20Textures/Neptune2d.png"
            },
            "Sun": {
                name: "Sun",
                description: "This is the central star of the Sol system, a massive fusion reactor providing energy to all its orbiting bodies. It keeps the planets warm, especially the third one, which seems to harbor an abundance of carbon-based life forms. Approach carefully – surface temperature is lethal to most known life forms.",
                image: "https://raw.githubusercontent.com/razvanpf/Images/main/2D%20Solar%20System%20Textures/Sun2d.png"
            },
            "Moon": {
                name: "Moon",
                description: "The only natural satellite of Earth. Fifth largest in the system and largest relative to its planet. Prime candidate for establishing an alien outpost – minimal atmosphere and history of Earthling exploration.",
                image: "https://raw.githubusercontent.com/razvanpf/Images/main/2D%20Solar%20System%20Textures/Moon2D.png"
            },
            "Phobos": {
                name: "Phobos",
                description: "The larger of Mars' two moons, irregularly shaped and a mere 11 km in radius. Low gravity and proximity to Mars make it an excellent spot for a refueling station.",
                image: "https://raw.githubusercontent.com/razvanpf/Images/main/2D%20Solar%20System%20Textures/Phobos2D.png"
            },
            "Deimos": {
                name: "Deimos",
                description: "The smaller and outermost of Mars' two moons. With a mean radius of 6.2 km, it offers a tranquil observation point for Mars. Light gravity: jump cautiously.",
                image: "https://raw.githubusercontent.com/razvanpf/Images/main/2D%20Solar%20System%20Textures/Deimos2D.png"
            },
            "Io": {
                name: "Io",
                description: "Jupiter's innermost Galilean moon. At 3,643.2 km in diameter, it's the fourth-largest moon in the system. Beware: the most volcanically active body encountered so far.",
                image: "https://raw.githubusercontent.com/razvanpf/Images/main/2D%20Solar%20System%20Textures/IO2D.png"
            },
            "Europa": {
                name: "Europa",
                description: "The smallest of Jupiter's Galilean moons and the sixth closest. Its icy surface hides a potentially vast ocean. Possibility of aquatic life forms: high.",
                image: "https://raw.githubusercontent.com/razvanpf/Images/main/2D%20Solar%20System%20Textures/Europa2D.png"
            },
            "Ganymede": {
                name: "Ganymede",
                description: "The largest and most massive moon of Jupiter, and in the system. Its own magnetic field makes it unique. Potential for alien energy harvesting?",
                image: "https://raw.githubusercontent.com/razvanpf/Images/main/2D%20Solar%20System%20Textures/Ganymede2D.png"
            },
            "Callisto": {
                name: "Callisto",
                description: "The second-largest moon of Jupiter and the third-largest in the system. An ancient, heavily cratered surface makes it a living museum of the system's history.",
                image: "https://raw.githubusercontent.com/razvanpf/Images/main/2D%20Solar%20System%20Textures/Callisto2D.png"
            },
            "Titan": {
                name: "Titan",
                description: "The largest moon of Saturn and second-largest in the system. Known for its dense atmosphere. Investigate further for extraterrestrial life and possible colonization.",
                image: "https://raw.githubusercontent.com/razvanpf/Images/main/2D%20Solar%20System%20Textures/Titan2D.png"
            },
            "Titania": {
                name: "Titania",
                description: "Titania offers spectacular cliffs and canyons, perfect for any adventure-seeking alien. However, it seems the only thing that falls faster than rocks here are your expectations to find anything.",
                image: "https://raw.githubusercontent.com/razvanpf/Images/main/2D%20Solar%20System%20Textures/Titania2D.png"
            },
            "Oberon": {
                name: "Oberon",
                description: "The second-largest moon of Uranus, Oberon, has a reddish tint and many impact craters. Humans named it after a fairy king. If you want to meet the king of space fairies, is Oberon the place?",
                image: "https://raw.githubusercontent.com/razvanpf/Images/main/2D%20Solar%20System%20Textures/Oberon2D.png"
            },
            "Miranda": {
                name: "Miranda",
                description: "The smallest and innermost of Uranus's five round satellites. Its extreme and varied landscape is a geologist's dream.",
                image: "https://raw.githubusercontent.com/razvanpf/Images/main/2D%20Solar%20System%20Textures/Miranda2D.png"
            },
            "Triton": {
                name: "Triton",
                description: "Neptune's largest moon with a unique retrograde orbit. Rich in nitrogen ice and geysers. Potential for harvesting exotic materials.",
                image: "https://raw.githubusercontent.com/razvanpf/Images/main/2D%20Solar%20System%20Textures/Triton2D.png"
            },
            "Ceres": {
                name: "Ceres",
                description: "The largest object in the asteroid belt and the only dwarf planet in the inner system. First asteroid discovered by Earthlings. Rich in water ice.",
                image: "https://raw.githubusercontent.com/razvanpf/Images/main/2D%20Solar%20System%20Textures/Ceres2D.png"
            },
            "Pluto": {
                name: "Pluto",
                description: "Pluto, initially considered the ninth planet, is now classified as a dwarf planet. Its highly eccentric orbit sometimes brings it closer to Sol than Neptune. Considered a remote outpost for exploration and mining.",
                image: "https://raw.githubusercontent.com/razvanpf/Images/main/2D%20Solar%20System%20Textures/Pluto2D.png"
            },

            "Charon": {
                name: "Charon",
                description: "The largest moon of Pluto, half the size of its parent dwarf planet. The surface is covered with water ice, creating an otherworldly landscape. Interestingly, Charon and Pluto are tidally locked, meaning they always show the same face to each other. It's like they're in a cosmic staring contest!",
                image: "https://raw.githubusercontent.com/razvanpf/Images/main/2D%20Solar%20System%20Textures/Charon2d.png"
            },

            "Haumea": {
                name: "Haumea",
                description: "Haumea is a dwarf planet located beyond Neptune's orbit. Its elongated shape is likely due to its rapid rotation. Haumea has two known moons, Hiʻiaka and Namaka. Unusual shape and rotation make it a curiosity.",
                image: "https://raw.githubusercontent.com/razvanpf/Images/main/2D%20Solar%20System%20Textures/Haumea2D.png"
            },
            "Makemake": {
                name: "Makemake",
                description: "Makemake is a dwarf planet located in the Kuiper Belt, known for its bright surface and the presence of methane ice. It is one of the largest known objects in the outer Solar System. Makemake was named after a fertility god, but all we found was ice! Do Earthlings think life springs from frozen methane?",
                image: "https://raw.githubusercontent.com/razvanpf/Images/main/2D%20Solar%20System%20Textures/Makemake2D.png"
            },
            "Eris": {
                name: "Eris",
                description: "Eris is one of the largest known dwarf planets in this system and is sometimes referred to as the 'tenth planet'. The most massive dwarf planet, located in the scattered disc. Prime candidate for deep space mining.",
                image: "https://raw.githubusercontent.com/razvanpf/Images/main/2D%20Solar%20System%20Textures/Eris2D.png"
            },
            "Voyager": {
                name: "Voyager",
                description: "Voyager is a pioneering probe dispatched by the Earthlings. Having traversed beyond the influence of their star, it now navigates interstellar space, transmitting intelligence about the boundary regions of this star system. Its transmission offers a unique insight into the capabilities and curiosities of its creators.",
                image: "https://raw.githubusercontent.com/razvanpf/Images/main/2D%20Solar%20System%20Textures/Voyager2D.png"
            }
        };
        // Mesh name to planet name for later use
        const meshNameToPlanetName = {
            "planet0": "Mercury",
            "planet1": "Venus",
            "planet2": "Earth",
            "planet3": "Mars",
            "planet4": "Jupiter",
            "planet5": "Saturn",
            "planet6": "Uranus",
            "planet7": "Neptune",
            "planet8": "Ceres",
            "planet9": "Pluto",
            "planet10": "Haumea",
            "planet11": "Makemake",
            "planet12": "Eris",
            "sun": "Sun",
            "moon0_0": "Moon",
            "moon2_0": "Moon",
            "moon3_0": "Phobos",
            "moon3_1": "Deimos",
            "moon4_0": "Io",
            "moon4_1": "Europa",
            "moon4_2": "Ganymede",
            "moon4_3": "Callisto",
            "moon5_0": "Titan",
            "moon6_0": "Titania",
            "moon6_1": "Oberon",
            "moon6_2": "Miranda",
            "moon7_0": "Triton",
            "moon9_0": "Charon",
            "Voyager": "Voyager"
        };

        const planetName = meshNameToPlanetName[mesh.name];
        const planetInfo = planetDescriptions[planetName] || {};
        
        //Popup info
        const info = `
            <div style="text-align: center;">
                <h1>You discovered</h1>
                <h2>${planetInfo.name || mesh.name}</h2>
                <img src="${planetInfo.image || ''}" class="popup-image" id="popup-image" alt="${planetInfo.name || mesh.name}" style="width: auto; height: auto;">
                <p>${planetInfo.description || ''}</p>
                Age: ${planetName === "Sun" ? "4.6 billion years" : "4.5 billion years"}<br>
                Mass: ${planetName === "Sun" ? "1.989 × 10^30 kg" : "5.972 × 10^24 kg"}<br>
                Atmosphere: ${planetName === "Sun" ? "Hydrogen, Helium" : "Nitrogen, Oxygen"}<br>
                Diameter: ${planetName === "Sun" ? "1.391 million km" : "12,742 km"}<br>
                Gravity: ${planetName === "Sun" ? "274 m/s²" : "9.8 m/s²"}<br>
                <button id="continueBtn" style="background-color: transparent; color: white; padding: 10px 20px; border: 2px solid blue; border-radius: 5px; cursor: pointer; margin-top: 20px;">
                    Continue exploration
                </button>
            </div>
        `;
        popup.innerHTML = info;
    
        document.getElementById("continueBtn").addEventListener("click", function () {
            popup.style.display = "none";
        });
    }
    
    // Prevent default right-click context menu
    window.addEventListener('contextmenu', (event) => {
        event.preventDefault();
    });
    
    // Disable right-click drag behavior
    const disableRightClickDrag = () => {
        canvas.oncontextmenu = (e) => {
            e.preventDefault();
        };
    };
    // Right click events
    const onRightMouseDown = (event) => {
        if (event.button === 2) { // Right mouse button
            event.preventDefault();
        }
    };
    
    const onRightMouseUp = (event) => {
        if (event.button === 2) { // Right mouse button
            event.preventDefault();
        }
    };
    
    const onRightMouseMove = (event) => {
        if (event.button === 2) { // Right mouse button
            event.preventDefault();
        }
    };

        // Voyager
/////////
async function loadVoyagerModel(scene) {

    try {
        const voyagerModel = await BABYLON.SceneLoader.ImportMeshAsync("", "https://raw.githubusercontent.com/razvanpf/Images/main/Voyager.glb", "", scene);
        const voyagerMesh = voyagerModel.meshes[0];

        if (!voyagerMesh) {
            console.error("Voyager mesh not found!");
            return;
        }

        // Scale and position of the model
        voyagerMesh.scaling = new BABYLON.Vector3(0.5, 0.5, 0.5);
        voyagerMesh.position = new BABYLON.Vector3(200, 0, 0);

        // Apply lights to all child meshes of the Voyager model
        voyagerMesh.getChildMeshes().forEach((childMesh, index) => {
            const light = new BABYLON.PointLight(`light_voyager_${index}`, new BABYLON.Vector3(0, 0, 0), scene);
            light.parent = childMesh; // Attach the light to the child mesh
            light.intensity = 50; // Adjust intensity as needed
            light.diffuse = new BABYLON.Color3(1, 1, 1); // White light
            light.specular = new BABYLON.Color3(1, 1, 1); // Specular color
            light.includedOnlyMeshes = [childMesh]; // Only affect this child mesh
        });

        // Ensure the Voyager mesh is pickable and name it
        voyagerMesh.isPickable = true;
        voyagerMesh.name = "Voyager";

        // Ensure the parent mesh has an action manager
        voyagerMesh.actionManager = new BABYLON.ActionManager(scene);

        // Centralize hover actions on the parent mesh
        voyagerMesh.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPointerOverTrigger, () => {
            outlineVoyager(voyagerMesh, true);
            scene.getEngine().getRenderingCanvas().style.cursor = 'pointer';
        }));

        voyagerMesh.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPointerOutTrigger, () => {
            outlineVoyager(voyagerMesh, false);
            scene.getEngine().getRenderingCanvas().style.cursor = 'default';
        }));

        voyagerMesh.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPickTrigger, () => {
            moveToTarget(voyagerMesh.position, () => {
                camera.setTarget(voyagerMesh.position);
                showPopup(voyagerMesh);
            });
        }));

        // Ensure child meshes reference the parent mesh and are pickable
        voyagerMesh.getChildMeshes().forEach((childMesh, index) => {
            childMesh.name = `Voyager_Child_${index}`;
            childMesh.isPickable = true;
            childMesh.parentMesh = voyagerMesh; // Reference to parent mesh

            // Make child meshes trigger parent's action manager events
            childMesh.actionManager = new BABYLON.ActionManager(scene);
            childMesh.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPointerOverTrigger, () => {
                voyagerMesh.actionManager.processTrigger(BABYLON.ActionManager.OnPointerOverTrigger, childMesh);
            }));
            childMesh.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPointerOutTrigger, () => {
                voyagerMesh.actionManager.processTrigger(BABYLON.ActionManager.OnPointerOutTrigger, childMesh);
            }));
            childMesh.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPickTrigger, () => {
                voyagerMesh.actionManager.processTrigger(BABYLON.ActionManager.OnPickTrigger, childMesh);
            }));
        });

        return voyagerMesh;
    } catch (error) {
        console.error("Failed to load Voyager model:", error);
    }
}

function outlineVoyager(voyagerMesh, outline) {
    voyagerMesh.getChildMeshes().forEach(childMesh => {
        childMesh.renderOutline = outline;
        childMesh.outlineWidth = 0.1;
        childMesh.outlineColor = BABYLON.Color3.White();
    });
}

canvas.addEventListener("mousedown", function (evt) {
    if (evt.button === 0) { // Left mouse button
        const pickResult = scene.pick(evt.clientX, evt.clientY);
        if (pickResult.hit) {
            const pickedMesh = pickResult.pickedMesh;
            const parentMesh = pickedMesh.parentMesh || pickedMesh;
            if (parentMesh.name === "Voyager") {
                moveToTarget(parentMesh.position, () => {
                    camera.setTarget(parentMesh.position);
                    showPopup(parentMesh);
                });
            }}
    }
});
    
    // Add event listeners to disable right-click drag
    canvas.addEventListener("mousedown", onRightMouseDown);
    canvas.addEventListener("mouseup", onRightMouseUp);
    canvas.addEventListener("mousemove", onRightMouseMove);

    //Before returning the scene
    createRings(scene);
    toggleOrbitsVisibility();

    // Load and add satellites around Earth
    loadSatellites(scene).then((satellites) => {
        const earthMesh = celestialBodies.find(body => body.data.name === "Earth").mesh;
        if (earthMesh) {
            animateSatellites(satellites, earthMesh);
        } else {
            console.error("Earth mesh not found!");
        }
    }).catch((error) => {
        console.error("Failed to load satellites:", error);
    });

    //Load Voyager
    loadVoyagerModel(scene).then(voyagerMesh => {
        createVoyagerLensFlareEffect(scene, voyagerMesh); // Initialize lens flare effect for Voyager
    }).catch(error => {
        console.error("Error loading Voyager model:", error);
    });

    
    return scene;
    };
    
    // Asteroid Load Model GLB
    const asteroidUrl = "https://raw.githubusercontent.com/razvanpf/Images/main/Asteroid2.glb";
    let asteroidModel; // Variable to store the asteroid model
    
    async function loadAsteroidModel(scene) {
        if (!asteroidModel) {
            const result = await BABYLON.SceneLoader.ImportMeshAsync("", asteroidUrl, "", scene);
            asteroidModel = result.meshes[0];
        }
    }
    
    // Load the asteroid mesh
    async function loadAsteroidModel(scene) {
        return await loadModel(asteroidUrl, scene, 1); // Load with default scaling
    }
    
    // Handle window resize
    window.addEventListener("resize", () => {
        engine.resize();
    });
    
    // Show the welcome popup and hide the controls initially
    window.onload = () => {
        const welcomePopup = document.getElementById('welcomePopup');
        const welcomeBtn = document.getElementById('welcomeBtn');
        const controlsDiv = document.getElementById('speedSliderContainer');
    
        welcomePopup.style.display = 'flex';
        controlsDiv.style.display = 'none';
    

        welcomeBtn.addEventListener('click', function () {
            welcomePopup.style.display = 'none';
            controlsDiv.style.display = 'flex'; // Show controls after closing the welcome popup
        });
    };
    
    function animateCameraToTarget(camera, target, onComplete) {
        const animation = new BABYLON.Animation("cameraAnimation", "position", 60, BABYLON.Animation.ANIMATIONTYPE_VECTOR3, BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT);
        const keys = [
            { frame: 0, value: camera.position },
            { frame: 60, value: target }
        ];
        animation.setKeys(keys);
        camera.animations.push(animation);
        scene.beginAnimation(camera, 0, 60, false, 1, onComplete);
    }
    
    // Main code to create and render the scene
    const scene = createScene();
    
    // Consider the simulation speed in redner loop
    let lastTime = performance.now();
    
    engine.runRenderLoop(() => {
        const currentTime = performance.now();
        const deltaTime = (currentTime - lastTime) * 0.001 * simulationSpeed; // Adjust speed based on simulationSpeed
        lastTime = currentTime;
    
        // Pass deltaTime to the scene
        scene.deltaTime = deltaTime;
    
        scene.render();
    });
    
    // Welcome Popup
    window.addEventListener("load", function () {
        // Display the welcome popup
        const welcomePopup = document.getElementById("welcomePopup");
        const welcomeBtn = document.getElementById("welcomeBtn");
    
        welcomePopup.style.display = "block";
    
        // Apply blur to the background
        const mainContent = document.getElementById("renderCanvas");
        mainContent.style.filter = "blur(5px)";
    
        // Close the popup and remove blur
        welcomeBtn.addEventListener("click", function () {
            welcomePopup.style.display = "none";
            mainContent.style.filter = "none";
        });
    });
    
    // Start updating target position
    function startUpdatingTargetPosition(planet) {
        if (intervalId) {
            clearInterval(intervalId);
        }
        intervalId = setInterval(() => {
            if (targetPosition) {
                targetPosition = planet.position.clone();
            }
        }, updateInterval);
        hasArrived = false; // Reset the flag when starting to update target position
    }
    
    // Stop updating target position
    function stopUpdatingTargetPosition() {
        if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
        }
    }
    

// DYNAMIC EVENTS - SOLAR FLARE
////////////////////////////////////

// Create solar flares with smoke texture
function createSolarFlare(scene, sun) {
    const flareSystem = new BABYLON.ParticleSystem("flare", 2000, scene); // number of particles
    flareSystem.particleTexture = new BABYLON.Texture("https://raw.githubusercontent.com/razvanpf/Images/main/smoke.png", scene);

    flareSystem.minEmitBox = new BABYLON.Vector3(-2, -2, -2); // emit box
    flareSystem.maxEmitBox = new BABYLON.Vector3(2, 2, 2);

    flareSystem.color1 = new BABYLON.Color4(1, 0.6, 0, 1.0);
    flareSystem.color2 = new BABYLON.Color4(1, 0.3, 0, 1.0);
    flareSystem.colorDead = new BABYLON.Color4(0, 0, 0, 0.0);

    flareSystem.minSize = 1.0; // Size
    flareSystem.maxSize = 3.0;

    flareSystem.minLifeTime = 0.3;
    flareSystem.maxLifeTime = 0.7; // lifetime

    flareSystem.emitRate = 200; // emit rate

    flareSystem.blendMode = BABYLON.ParticleSystem.BLENDMODE_ONEONE;

    flareSystem.gravity = new BABYLON.Vector3(0, 0, 0);

    flareSystem.direction1 = new BABYLON.Vector3(-1, -1, -1);
    flareSystem.direction2 = new BABYLON.Vector3(1, 1, 1);

    flareSystem.minAngularSpeed = 0;
    flareSystem.maxAngularSpeed = Math.PI;

    flareSystem.minEmitPower = 2;
    flareSystem.maxEmitPower = 5;
    flareSystem.updateSpeed = 0.01;

    return flareSystem;
}

// Add the solar flare effect
const flareSystem = createSolarFlare(scene, sun);

// Randomize the emitter position
function randomizeEmitterPosition(flareSystem, sun) {
    const positions = [
        new BABYLON.Vector3(sun.position.x + 10.5, sun.position.y, sun.position.z), // Right
        new BABYLON.Vector3(sun.position.x - 10.5, sun.position.y, sun.position.z), // Left
        new BABYLON.Vector3(sun.position.x, sun.position.y + 10.5, sun.position.z)  // North
    ];
    const randomIndex = Math.floor(Math.random() * positions.length);
    flareSystem.emitter = positions[randomIndex];
}

// Trigger the solar flare
function triggerSolarFlare() {
    randomizeEmitterPosition(flareSystem, sun);
    flareSystem.start();
    setTimeout(() => {
        flareSystem.stop();
    }, 3000); // Flare lasts for 3 seconds
}

// Test the solar flare 10 seconds after loading the page - Should remove later or keep it , idk.
setTimeout(triggerSolarFlare, 10000);

// Random dynamic event for solar flare
function randomSolarFlareEvent() {
    const randomTime = Math.random() * 30000; // Random time between 0 and 30 seconds
    setTimeout(() => {
        triggerSolarFlare();
        randomSolarFlareEvent(); // Schedule the next random solar flare event
    }, randomTime);
}

randomSolarFlareEvent();

// DYNAMIC EVENTS - COMET PASSING BY
////////////////////////////////////
let activeComet = null; // To track the active comet

// Create an explosion effect
function createExplosionEffect(scene, position) {
    const particleSystem = new BABYLON.ParticleSystem("explosion", 2000, scene);
    particleSystem.particleTexture = new BABYLON.Texture("https://assets.babylonjs.com/textures/flare.png", scene);

    particleSystem.emitter = position;
    particleSystem.minEmitBox = new BABYLON.Vector3(-1, -1, -1);
    particleSystem.maxEmitBox = new BABYLON.Vector3(1, 1, 1);

    particleSystem.color1 = new BABYLON.Color4(1, 0.5, 0, 1.0);
    particleSystem.color2 = new BABYLON.Color4(1, 0, 0, 1.0);
    particleSystem.colorDead = new BABYLON.Color4(0, 0, 0, 0.0);

    particleSystem.minSize = 0.1;
    particleSystem.maxSize = 1.0;

    particleSystem.minLifeTime = 0.2;
    particleSystem.maxLifeTime = 0.5;

    particleSystem.emitRate = 5000;

    particleSystem.blendMode = BABYLON.ParticleSystem.BLENDMODE_ONEONE;

    particleSystem.gravity = new BABYLON.Vector3(0, 0, 0);

    particleSystem.direction1 = new BABYLON.Vector3(-1, -1, -1);
    particleSystem.direction2 = new BABYLON.Vector3(1, 1, 1);

    particleSystem.minAngularSpeed = 0;
    particleSystem.maxAngularSpeed = Math.PI;

    particleSystem.minEmitPower = 1;
    particleSystem.maxEmitPower = 10;
    particleSystem.updateSpeed = 0.01;

    particleSystem.start();

    // Stop particle system after 1 second and dispose it properly
    setTimeout(() => {
        particleSystem.stop();
        particleSystem.dispose();
    }, 1000);
}

// Handle collision with the sun
function checkCometCollision(comet, sun, scene) {
    const checkCollision = () => {
        if (comet && sun) {
            const distance = BABYLON.Vector3.Distance(comet.position, sun.position);
            const sunRadius = 10; // Sun radius is half the diameter

            if (distance < sunRadius) {
                const explosionPosition = sun.position.add(comet.position.subtract(sun.position).normalize().scale(sunRadius));
                createExplosionEffect(scene, explosionPosition);
                comet.dispose(); // Destroy the comet
                activeComet = null; // Reset the active comet
                scene.unregisterBeforeRender(checkCollision); // Unregister the render loop for collision check
                setTimeout(triggerCometEvent, 20000); // Reset the comet event after 20 seconds
            }
        }
    };
    scene.registerBeforeRender(checkCollision);
}

// Create the comet with asteroid mesh and blue tint
async function createComet(scene) {
    if (activeComet) {
        return null; // Return if there's already an active comet
    }

    try {
        // Load the asteroid mesh
        const comet = await BABYLON.SceneLoader.ImportMeshAsync(
            "",
            "https://raw.githubusercontent.com/razvanpf/Images/main/Asteroid2.glb",
            "",
            scene
        );

        const cometMesh = comet.meshes[0];
        cometMesh.scaling = new BABYLON.Vector3(0.025, 0.025, 0.025); // Adjust size to half

        const cometMaterial = new BABYLON.StandardMaterial("cometMaterial", scene);
        cometMaterial.diffuseTexture = new BABYLON.Texture("https://raw.githubusercontent.com/razvanpf/Images/main/2k_mars.jpg", scene); // Asteroid texture URL
        cometMaterial.diffuseColor = new BABYLON.Color3(0.5, 0.5, 1); // Blue tint
        cometMesh.material = cometMaterial;

        // Create the particle system for the comet's tail
        const tailSystem = new BABYLON.ParticleSystem("cometTail", 10000, scene);
        tailSystem.particleTexture = new BABYLON.Texture("https://raw.githubusercontent.com/razvanpf/Images/main/smoke.png", scene);

        tailSystem.minEmitBox = new BABYLON.Vector3(-0.5, 0, 0); // Starting point
        tailSystem.maxEmitBox = new BABYLON.Vector3(0.5, 0, 0);  // Ending point

        tailSystem.color1 = new BABYLON.Color4(0.5, 0.5, 1, 1.0);
        tailSystem.color2 = new BABYLON.Color4(0.2, 0.2, 0.8, 1.0);
        tailSystem.colorDead = new BABYLON.Color4(0, 0, 1, 0.0);

        tailSystem.minSize = 0.2; 
        tailSystem.maxSize = 0.4; 

        tailSystem.minLifeTime = 0.1; 
        tailSystem.maxLifeTime = 0.3; 

        tailSystem.emitRate = 10000; 

        tailSystem.blendMode = BABYLON.ParticleSystem.BLENDMODE_ONEONE;

        tailSystem.gravity = new BABYLON.Vector3(0, 0, 0);

        tailSystem.direction1 = new BABYLON.Vector3(-1, 1, -1);
        tailSystem.direction2 = new BABYLON.Vector3(1, 1, 1);

        tailSystem.minAngularSpeed = 0;
        tailSystem.maxAngularSpeed = Math.PI;

        tailSystem.minEmitPower = 1; 
        tailSystem.maxEmitPower = 2; 
        tailSystem.updateSpeed = 0.01;

        tailSystem.emitter = cometMesh; // Attach the tail to the comet
        tailSystem.start();

        activeComet = cometMesh;
        checkCometCollision(activeComet, sun, scene); // Check for collision with the sun
        return cometMesh;
    } catch (error) {
        console.error("Error creating comet:", error);
        return null;
    }
}

// Animate the comet through the solar system
function animateComet(comet, scene) {
    if (!comet || !scene) {
        console.error("Comet or scene is not defined");
        return;
    }

    const distance = 300;

    // Comet travels horizontally through the solar system
    const startX = Math.random() < 0.5 ? -distance : distance;
    const startY = (Math.random() * 20) - 10; // Small vertical variation
    const startZ = (Math.random() * 40) - 20; // Small depth variation

    const endX = -startX + (Math.random() * 40 - 20); // Increased horizontal variation
    const endY = (Math.random() * 60) - 30; // Increased vertical variation
    const endZ = (Math.random() * 80) - 40; // Increased depth variation

    const startPosition = new BABYLON.Vector3(startX, startY, startZ);
    const endPosition = new BABYLON.Vector3(endX, endY, endZ); // Increased randomization

    comet.position = startPosition;

    const animation = new BABYLON.Animation(
        "cometAnimation",
        "position",
        30,
        BABYLON.Animation.ANIMATIONTYPE_VECTOR3,
        BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
    );

    const keys = [
        { frame: 0, value: startPosition },
        { frame: 300, value: endPosition } //Speed
    ];

    animation.setKeys(keys);
    comet.animations = [];
    comet.animations.push(animation);

    scene.beginDirectAnimation(comet, [animation], 0, 300, false, 1, () => {
        comet.dispose(); // Remove comet after animation
        activeComet = null; // Reset the active comet
    });
}

// Trigger the comet event
async function triggerCometEvent() {
    if (activeComet) {
        return; // Return if there's already an active comet
    }
    const comet = await createComet(scene);
    if (comet) {
        animateComet(comet, scene);
    }
}

// Handle random dynamic events for Comet
function randomCometEvent() {
    const randomTime = 20000; // 20 seconds
    setTimeout(() => {
        if (!activeComet) {
            triggerCometEvent();
        }
        randomCometEvent(); // Schedule the next random comet event
    }, randomTime);
}

// Start the random event for comet
randomCometEvent();

// Update slider text
function updateSliderText(sliderValue) {
    const speedFactor = ((sliderValue - 1) / 999) * 9.0 + 0.1; // This formula...My god...
    const speedText = speedFactor.toFixed(1) + "x"; // Format to 1 decimal place
    document.getElementById("speedDisplay").innerText = speedText;
}

// BLINKING LIGHTS
//////////////////

// Create a small lens flare effect above the north pole of the dwarf planets
function createLensFlareEffect(scene, mesh) {
    if (!mesh.lensFlareSystem) {
        const lensFlareSystem = new BABYLON.LensFlareSystem(`lensFlareSystem_${mesh.name}`, mesh, scene);

        // Create a single lens flare
        const lensFlare = new BABYLON.LensFlare(0.025, 1.0, new BABYLON.Color3(1, 1, 1), "https://raw.githubusercontent.com/razvanpf/Images/main/starburst.jpg", lensFlareSystem);

        // Adjust the position to be above the north pole
        lensFlareSystem.position = mesh.position.add(new BABYLON.Vector3(0, mesh.scaling.y * 2, 0));

        // Start the lens flare effect
        const startLensFlare = () => {
            if (!mesh.blinking) return;
            lensFlareSystem.isEnabled = true;
            setTimeout(() => {
                lensFlareSystem.isEnabled = false;
            }, 1000); // Stop after 1 second
        };

        // Repeat the lens flare every 5 seconds
        mesh.blinking = true;
        const interval = setInterval(() => {
            if (mesh.blinking) {
                startLensFlare();
            }
        }, 5000);

        mesh.lensFlareSystem = lensFlareSystem;
        mesh.lensFlareInterval = interval;
    }
}

// Stop the lens flare effect
function stopLensFlareEffect(mesh) {
    if (mesh && mesh.lensFlareSystem && mesh.lensFlareInterval) {
        clearInterval(mesh.lensFlareInterval);
        mesh.lensFlareSystem.dispose();
        mesh.lensFlareSystem = null;
        mesh.lensFlareInterval = null;
        mesh.blinking = false;
    } else {
        console.warn(`Lens flare system for ${mesh ? mesh.name : 'unknown mesh'} is already disposed or not created.`);
    }
}

// Add lens flare effects to dwarf planets
function addLensFlareEffectsToDwarfPlanets(scene) {
    celestialBodies.forEach(body => {
        if (body.data.name === "Ceres" || body.data.name === "Pluto" || body.data.name === "Haumea" || body.data.name === "Makemake" || body.data.name === "Eris" || body.data.name === "Voyager") {
            createLensFlareEffect(scene, body.mesh);
        }
    });
}

// Create a lens flare effect for Voyager
function createVoyagerLensFlareEffect(scene, mesh) {
    if (!mesh.lensFlareSystem) {
        const lensFlareSystem = new BABYLON.LensFlareSystem(`lensFlareSystem_${mesh.name}`, mesh, scene);

        // Create a single lens flare
        const lensFlare = new BABYLON.LensFlare(0.025, 1.0, new BABYLON.Color3(1, 1, 1), "https://raw.githubusercontent.com/razvanpf/Images/main/starburst.jpg", lensFlareSystem);

        // Adjust the position to be above the mesh
        lensFlareSystem.position = mesh.position.add(new BABYLON.Vector3(0, mesh.scaling.y * 2, 0));

        // Start the lens flare effect
        const startLensFlare = () => {
            if (!mesh.blinking) return;
            lensFlareSystem.isEnabled = true;
            setTimeout(() => {
                lensFlareSystem.isEnabled = false;
            }, 1000); // Stop after 1 second
        };

        // Repeat the lens flare every 5 seconds
        mesh.blinking = true;
        const interval = setInterval(() => {
            if (mesh.blinking) {
                startLensFlare();
            }
        }, 5000);

        mesh.lensFlareSystem = lensFlareSystem;
        mesh.lensFlareInterval = interval;
    }
}

// Stop the lens flare effect for Voyager
function stopVoyagerLensFlareEffect(mesh) {
    if (mesh && mesh.lensFlareSystem && mesh.lensFlareInterval) {
        clearInterval(mesh.lensFlareInterval);
        mesh.lensFlareSystem.dispose();
        mesh.lensFlareSystem = null;
        mesh.lensFlareInterval = null;
        mesh.blinking = false;
    } else {
        console.warn(`Lens flare system for ${mesh ? mesh.name : 'unknown mesh'} is already disposed or not created.`);
    }
}

// Disable blinking tooltip
///////////////////////////

// Tooltip logic
const tooltip = document.getElementById('tooltip');
const infoIcon = document.getElementById('infoIcon');
const closeBtn = document.getElementById('closeTooltipBtn');

infoIcon.addEventListener('click', function (event) {
    event.stopPropagation(); // Prevent checkbox toggle
    const rect = infoIcon.getBoundingClientRect();

    // Force positioning
    tooltip.style.left = `${rect.left + window.scrollX - 100}px`; // Adjust the -100 value to move left
    tooltip.style.top = `${rect.top + window.scrollY - tooltip.offsetHeight - 150}px`; // Adjust the -50 value to move up

    tooltip.classList.toggle('show');
});

closeBtn.addEventListener('click', function () {
    tooltip.classList.remove('show');
});