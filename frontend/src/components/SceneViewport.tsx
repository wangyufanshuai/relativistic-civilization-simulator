import React from "react";
import * as THREE from "three";
import type { BlackHoleZone, Fleet, Metric, Polity, StarSystem, TradeRoute } from "../types/sim";

interface SceneWorld {
  year: number;
  systems: StarSystem[];
  polities: Polity[];
  fleets: Fleet[];
  trade_routes: TradeRoute[];
  black_hole?: BlackHoleZone | null;
}

interface SceneViewportProps {
  world?: SceneWorld;
  metric?: Metric;
  selectedSystemId?: string;
  onSelectSystem: (systemId: string) => void;
}

export function SceneViewport({ world, metric, selectedSystemId, onSelectSystem }: SceneViewportProps) {
  const mountRef = React.useRef<HTMLDivElement | null>(null);
  const sceneRef = React.useRef<THREE.Scene | null>(null);
  const cameraRef = React.useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = React.useRef<THREE.WebGLRenderer | null>(null);
  const raycasterRef = React.useRef(new THREE.Raycaster());
  const starMeshesRef = React.useRef<THREE.Mesh[]>([]);

  React.useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#05070c");
    scene.fog = new THREE.Fog("#05070c", 45, 125);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(46, mount.clientWidth / mount.clientHeight, 0.1, 240);
    camera.position.set(0, 54, 78);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    rendererRef.current = renderer;
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight("#7dd3fc", 1.4));
    const key = new THREE.DirectionalLight("#ffffff", 2.1);
    key.position.set(20, 40, 35);
    scene.add(key);

    const backgroundStars = new THREE.BufferGeometry();
    const positions = new Float32Array(
      Array.from({ length: 900 }, () => [Math.random() * 180 - 90, Math.random() * 70 - 20, Math.random() * 180 - 90]).flat()
    );
    backgroundStars.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const starField = new THREE.Points(backgroundStars, new THREE.PointsMaterial({ color: "#b9e7ff", size: 0.18, transparent: true, opacity: 0.42 }));
    scene.add(starField);

    let frame = 0;
    const animate = () => {
      frame = requestAnimationFrame(animate);
      scene.rotation.y += 0.0008;
      renderer.render(scene, camera);
    };
    animate();

    const resize = () => {
      if (!mountRef.current || !cameraRef.current || !rendererRef.current) return;
      cameraRef.current.aspect = mountRef.current.clientWidth / mountRef.current.clientHeight;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    };
    window.addEventListener("resize", resize);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, []);

  React.useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    starMeshesRef.current = [];
    scene.children.filter((child) => child.userData.simObject).forEach((child) => scene.remove(child));
    if (!world) return;

    const polityColor = new Map(world.polities.map((polity) => [polity.id, polity.color]));
    const positionOf = new Map(world.systems.map((system) => [system.id, new THREE.Vector3(system.position.x, system.position.z, system.position.y)]));

    world.trade_routes.slice(0, 60).forEach((route) => {
      const a = positionOf.get(route.a_id);
      const b = positionOf.get(route.b_id);
      if (!a || !b) return;
      const material = new THREE.LineBasicMaterial({
        color: route.risk > 0.35 ? "#f59e0b" : "#22d3ee",
        transparent: true,
        opacity: Math.max(0.08, 0.36 - route.risk * 0.22)
      });
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]), material);
      line.userData.simObject = true;
      scene.add(line);
    });

    world.fleets.filter((fleet) => !fleet.arrived).forEach((fleet) => {
      const a = positionOf.get(fleet.origin_id);
      const b = positionOf.get(fleet.destination_id);
      if (!a || !b) return;
      const mid = a.clone().lerp(b, 0.5).add(new THREE.Vector3(0, 4 + fleet.velocity_c * 4, 0));
      const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
      const arc = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(curve.getPoints(28)),
        new THREE.LineBasicMaterial({ color: "#eab308", transparent: true, opacity: 0.82 })
      );
      arc.userData.simObject = true;
      scene.add(arc);
    });

    if (world.black_hole) {
      const pos = new THREE.Vector3(world.black_hole.position.x, world.black_hole.position.z, world.black_hole.position.y);
      const hole = new THREE.Mesh(
        new THREE.SphereGeometry(2.3, 40, 24),
        new THREE.MeshStandardMaterial({ color: "#14091f", emissive: "#7c3aed", emissiveIntensity: 1.4, roughness: 0.25 })
      );
      hole.position.copy(pos);
      hole.userData.simObject = true;
      scene.add(hole);
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(world.black_hole.radius_ly, 0.08, 8, 96),
        new THREE.MeshBasicMaterial({ color: "#a78bfa", transparent: true, opacity: 0.26 })
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.copy(pos);
      ring.userData.simObject = true;
      scene.add(ring);
    }

    world.systems.forEach((system) => {
      const colonized = system.population > 0;
      const radius = colonized ? 0.55 + Math.min(1.3, system.population * 0.08) : 0.28;
      const color = colonized ? polityColor.get(system.polity_id) ?? "#38bdf8" : "#445164";
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(radius, 18, 12),
        new THREE.MeshStandardMaterial({
          color,
          emissive: colonized ? color : "#0f172a",
          emissiveIntensity: colonized ? 0.55 : 0.12,
          roughness: 0.45
        })
      );
      mesh.position.set(system.position.x, system.position.z, system.position.y);
      mesh.userData.simObject = true;
      mesh.userData.systemId = system.id;
      starMeshesRef.current.push(mesh);
      scene.add(mesh);

      if (system.id === selectedSystemId || system.autonomy > 0.45) {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(radius + (system.id === selectedSystemId ? 0.7 : 0.48), 0.05, 8, 64),
          new THREE.MeshBasicMaterial({
            color: system.id === selectedSystemId ? "#ffffff" : "#f59e0b",
            transparent: true,
            opacity: system.id === selectedSystemId ? 0.85 : Math.min(0.75, system.autonomy),
          })
        );
        ring.position.copy(mesh.position);
        ring.rotation.x = Math.PI / 2;
        ring.userData.simObject = true;
        scene.add(ring);
      }
    });

    const lightConeRadius = Math.max(4, Math.min(46, world.year * 0.22));
    const cone = new THREE.Mesh(
      new THREE.TorusGeometry(lightConeRadius, 0.04, 8, 128),
      new THREE.MeshBasicMaterial({ color: "#22d3ee", transparent: true, opacity: 0.25 })
    );
    cone.rotation.x = Math.PI / 2;
    cone.userData.simObject = true;
    scene.add(cone);
  }, [world, selectedSystemId]);

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const mount = mountRef.current;
    const camera = cameraRef.current;
    if (!mount || !camera) return;
    const rect = mount.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
    raycasterRef.current.setFromCamera(mouse, camera);
    const hit = raycasterRef.current.intersectObjects(starMeshesRef.current)[0];
    if (hit?.object.userData.systemId) {
      onSelectSystem(hit.object.userData.systemId as string);
    }
  };

  const selected = world?.systems.find((system) => system.id === selectedSystemId);

  return (
    <section className="scenePanel">
      <div className="sceneHeader">
        <div>
          <strong>3D relativistic star graph</strong>
          <span>cyan links are delayed communication/trade, amber arcs are active near-c fleets</span>
        </div>
        <div className="sceneLegend">
          <span><i className="legendCyan" /> light cone</span>
          <span><i className="legendAmber" /> fleet</span>
          <span><i className="legendViolet" /> black hole</span>
        </div>
      </div>
      <div ref={mountRef} className="sceneCanvas" onClick={handleClick} />
      {selected && (
        <div className="systemPopover">
          <strong>{selected.name}</strong>
          <span>{selected.population > 0 ? `${selected.population.toFixed(2)}B people` : "uncolonized"}</span>
          {metric && (
            <span>
              risk {Math.round(metric.split_risk * 100)}% - avg delay {metric.average_delay.toFixed(1)}y
            </span>
          )}
          <span>loyalty {Math.round(selected.loyalty * 100)}% · autonomy {Math.round(selected.autonomy * 100)}%</span>
        </div>
      )}
    </section>
  );
}
