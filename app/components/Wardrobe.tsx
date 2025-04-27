'use client';

import * as THREE from 'three';
import { type ComponentRef, useRef } from 'react';
import { useAnimations, useGLTF, Line } from '@react-three/drei';
import { type ThreeElements, type ThreeEvent, useFrame, useThree } from '@react-three/fiber';
import { GLTF } from 'three-stdlib';
import { Mesh, type LineData } from './Mesh';
import { useApp } from '@/contexts/AppContext';
import { useEventListener } from '@/hooks/useEventListener';
import { LineHint } from '@/components/LineHint';

type ActionName =
  | 'OpenBShelve'
  | 'OpenBL'
  | 'OpenBM'
  | 'OpenTL'
  | 'OpenTM'
  | 'Fronts CargoAction'
  | 'OpenBR'
  | 'OpenTR';

interface GLTFAction extends THREE.AnimationClip {
  name: ActionName;
}

type GLTFResult = GLTF & {
  nodes: {
    Frame: THREE.Mesh;
    BackCap: THREE.Mesh;
    AFront: THREE.Mesh;
    FrontsBBL: THREE.Mesh;
    FrontsHandlesBBL: THREE.Mesh;
    FrontsBBR: THREE.Mesh;
    FrontsHandlesBBR: THREE.Mesh;
    FrontsBTL: THREE.Mesh;
    FrontsBTR: THREE.Mesh;
    FrontsCB: THREE.Mesh;
    FrontsDB: THREE.Mesh;
    FrontsHandlesDBL: THREE.Mesh;
    FrontsDCoverR: THREE.Mesh;
    FrontsDT: THREE.Mesh;
    LightsLEDCTR: THREE.Mesh;
    LightsLEDCTL: THREE.Mesh;
    LightsLEDATR: THREE.Mesh;
    InBSupportL: THREE.Mesh;
    InBSupportR: THREE.Mesh;
    InBTopShelve: THREE.Mesh;
    InBTopShelve001: THREE.Mesh;
    InBTopShelve002: THREE.Mesh;
    InBTopShelve003: THREE.Mesh;
    InBTopShelve004: THREE.Mesh;
    InBTopShelve005: THREE.Mesh;
    InBTopShelve006: THREE.Mesh;
    InBTopShelve007: THREE.Mesh;
    InBTopShelve008: THREE.Mesh;
    InBTopShelve010: THREE.Mesh;
    InBTopShelve011: THREE.Mesh;
    InBTopShelve012: THREE.Mesh;
    InBTopShelve013: THREE.Mesh;
    InBTopShelve014: THREE.Mesh;
    InBTopLightsLEDL: THREE.Mesh;
    InBTopLightsLERR: THREE.Mesh;
    InBBottomSupportR: THREE.Mesh;
    InBBottomSupportTop: THREE.Mesh;
    InBBottomSupportMid: THREE.Mesh;
    InBBottomShelveL: THREE.Mesh;
    InBBottomSupportMid001: THREE.Mesh;
    InBBottomSupportR001: THREE.Mesh;
    InBBottomDrawersBigBR: THREE.Mesh;
    InBBottomDrawersMediumR3: THREE.Mesh;
    InBBottomDrawersMediumR3003: THREE.Mesh;
    InBBottomDrawersLightsLEDTop: THREE.Mesh;
    InBBottomDrawersMediumR3001: THREE.Mesh;
    InBBottomDrawersMediumR3002: THREE.Mesh;
    InBBottomDrawersMediumR3004: THREE.Mesh;
    InBBottomDrawersBigBR001: THREE.Mesh;
    InBBottomDrawersBigBR002: THREE.Mesh;
    InCSvelve: THREE.Mesh;
    InCSvelve001: THREE.Mesh;
    InCSvelve002: THREE.Mesh;
    InCSvelve003: THREE.Mesh;
    InCSupportDrawerR: THREE.Mesh;
    InCSupportR: THREE.Mesh;
    InCLightsLED: THREE.Mesh;
    InDSvelve: THREE.Mesh;
    InDSvelve001: THREE.Mesh;
    InDSvelve002: THREE.Mesh;
    InDSvelve003: THREE.Mesh;
    InDSvelve004: THREE.Mesh;
    InDShelveMini: THREE.Mesh;
    InDLisgtsLEDR: THREE.Mesh;
    InDSupportMid001: THREE.Mesh;
    InDShelveMini001: THREE.Mesh;
    InDShelveMini002: THREE.Mesh;
    InDShelveMini003: THREE.Mesh;
    InDSvelve005: THREE.Mesh;
    AShelves: THREE.Mesh;
    AShelves002: THREE.Mesh;
    AShelves003: THREE.Mesh;
    AShelves004: THREE.Mesh;
    AShelves005: THREE.Mesh;
  };
  materials: object;
  animations: GLTFAction[];
};

const path = `${process.env.BASEPATH ?? ''}/models/Wardrobe.glb`;

export function Model(props: ThreeElements['group']) {
  const lineRef = useRef<ComponentRef<typeof Line>>(null!);
  const sceneGroup = useRef<THREE.Group>(null!);
  const lineGroup = useRef<THREE.Group>(null!);
  const pointerPos = useRef<THREE.Vector2>(new THREE.Vector2());
  const { nodes, animations } = useGLTF(path) as unknown as GLTFResult;
  const { actions } = useAnimations(animations, sceneGroup);
  const { wireframe, line, hideFronts } = useApp();

  const ToggleAction = (name: ActionName, event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    const action = actions[name]!;
    const data = event.eventObject.userData;
    action.reset();

    if (data.open) {
      action.timeScale = -1;
      action.time = action.getClip().duration / 3;
    } else {
      action.timeScale = 1;
    }

    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.play();
    data.open = !data.open;
  };

  const isLMBPressed = useRef(false);

  useEventListener('pointerdown', () => (isLMBPressed.current = true));
  useEventListener('pointerup', () => (isLMBPressed.current = false));

  const { pointer, raycaster, camera } = useThree();

  useFrame(() => {
    if (isLMBPressed.current) return;
    if (!lineGroup.current || !lineRef.current || !sceneGroup.current) return;
    if (pointerPos.current.equals(pointer)) return;
    pointerPos.current.copy(pointer);

    if (!wireframe) {
      line.current = null;
      return;
    }

    raycaster.layers.set(1);
    raycaster.firstHitOnly = true;
    raycaster.setFromCamera(pointer, camera);
    const intersects = raycaster.intersectObject(sceneGroup.current, true);
    raycaster.layers.set(0);

    // const line = intersects[0]?.object.userData as LineData;
    const lineData = intersects.find(i => i.object.name.startsWith('line'))?.object
      .userData as LineData;

    if (!lineData) {
      const onBlur = line.current?.onBlur;
      line.current = null;
      lineRef.current.visible = false;
      onBlur?.();
      return;
    }

    if (line.current === lineData) return;

    line.current?.onBlur();
    line.current = lineData;
    showRedLine(lineData);
    line.current.onHover();

    // Hide ocluded

    // line.points.forEach(p => {
    //   const worldPoint = line.meshRef.current.localToWorld(p.clone());
    //
    //   raycaster.layers.set(0);
    //   raycaster.firstHitOnly = false;
    //   // raycaster.set()FromCamera(new THREE.Vector2(worldPoint.x, worldPoint.y).normalize(), camera);
    //   // const intersects = raycaster.intersectObject(sceneGroup.current, true);
    // });
  });

  const showRedLine = ({ meshRef, points }: LineData) => {
    lineRef.current.position.copy(meshRef.current.position);
    lineRef.current.rotation.copy(meshRef.current.rotation);
    lineRef.current.geometry.setPositions(points.map(p => [p.x, p.y, p.z]).flat());

    if (meshRef.current.parent?.type === 'Mesh') {
      lineGroup.current.position.copy(meshRef.current.parent.position);
      lineGroup.current.rotation.copy(meshRef.current.parent.rotation);
    } else {
      lineGroup.current.position.set(0, 0, 0);
      lineGroup.current.rotation.set(0, 0, 0);
    }
    lineRef.current.visible = true;

    // lineRef.current.geometry.setPositions(
    //   points.map(p => meshRef.current.localToWorld(p.clone()).toArray()).flat(),
    // );
  };

  return (
    <group {...props} dispose={null}>
      <group ref={lineGroup}>
        <LineHint />
        <Line
          ref={lineRef}
          visible={wireframe}
          points={[0, 0, 0, 0, 0, 0]}
          lineWidth={2.5}
          color="red"
          renderOrder={1000}
        />
      </group>

      <group ref={sceneGroup} name="Scene">
        <Mesh name="Frame" geometry={nodes.Frame.geometry} material={nodes.Frame.material} position={[-0.265, 1.6525, -1.0025]} />
        <Mesh name="BackCap" geometry={nodes.BackCap.geometry} material={nodes.BackCap.material} position={[0.001, 1.323333, -1.0075]} />
        <Mesh name="AFront" onClick={event => ToggleAction('OpenBShelve', event)} visible={!hideFronts} geometry={nodes.AFront.geometry} material={nodes.AFront.material} position={[-0.5025, 0.045, -2.2925]} />
        <Mesh name="FrontsBBL" onClick={event => ToggleAction('OpenBL', event)} visible={!hideFronts} geometry={nodes.FrontsBBL.geometry} material={nodes.FrontsBBL.material} position={[-0.5025, 0.045, -2.2275]}>
          <Mesh name="FrontsHandlesBBL" visible={!hideFronts} geometry={nodes.FrontsHandlesBBL.geometry} material={nodes.FrontsHandlesBBL.material} position={[-0.034167, 0.972, 0.5]} />
        </Mesh>
        <Mesh name="FrontsBBR" onClick={event => ToggleAction('OpenBM', event)} visible={!hideFronts} geometry={nodes.FrontsBBR.geometry} material={nodes.FrontsBBR.material} position={[-0.5025, 0.045, -1.0575]}>
          <Mesh name="FrontsHandlesBBR" visible={!hideFronts} geometry={nodes.FrontsHandlesBBR.geometry} material={nodes.FrontsHandlesBBR.material} position={[-0.034179, 0.972, -0.5]} />
        </Mesh>
        <Mesh name="FrontsBTL" onClick={event => ToggleAction('OpenTL', event)} visible={!hideFronts} geometry={nodes.FrontsBTL.geometry} material={nodes.FrontsBTL.material} position={[-0.5025, 2.025, -2.2275]} />
        <Mesh name="FrontsBTR" onClick={event => ToggleAction('OpenTM', event)} visible={!hideFronts} geometry={nodes.FrontsBTR.geometry} material={nodes.FrontsBTR.material} position={[-0.5025, 2.025, -1.0575]} />
        <Mesh name="FrontsCB" onClick={event => ToggleAction('Fronts CargoAction', event)} visible={!hideFronts} geometry={nodes.FrontsCB.geometry} material={nodes.FrontsCB.material} position={[-0.5025, 0.045, -0.6925]} />
        <Mesh name="FrontsDB" onClick={event => ToggleAction('OpenBR', event)} visible={!hideFronts} geometry={nodes.FrontsDB.geometry} material={nodes.FrontsDB.material} position={[-0.5025, 0.045, -0.1575]}>
          <Mesh name="FrontsHandlesDBL" visible={!hideFronts} geometry={nodes.FrontsHandlesDBL.geometry} material={nodes.FrontsHandlesDBL.material} position={[-0.034179, 0.972, -0.44]} />
        </Mesh>
        <Mesh name="FrontsDCoverR" geometry={nodes.FrontsDCoverR.geometry} material={nodes.FrontsDCoverR.material} position={[-0.501, 1.33, -0.095]} />
        <Mesh name="FrontsDT" onClick={event => ToggleAction('OpenTR', event)} visible={!hideFronts} geometry={nodes.FrontsDT.geometry} material={nodes.FrontsDT.material} position={[-0.5025, 2.025, -0.1575]} />
        <Mesh name="LightsLEDCTR" geometry={nodes.LightsLEDCTR.geometry} material={nodes.LightsLEDCTR.material} position={[-0.4325, 1.985, -0.7255]} />
        <Mesh name="LightsLEDCTL" geometry={nodes.LightsLEDCTL.geometry} material={nodes.LightsLEDCTL.material} position={[-0.4325, 1.985, -1.0045]} />
        <Mesh name="LightsLEDATR" geometry={nodes.LightsLEDATR.geometry} material={nodes.LightsLEDATR.material} position={[-0.4325, 1.612, -2.2805]} />
        <Mesh name="InBSupportL" geometry={nodes.InBSupportL.geometry} material={nodes.InBSupportL.material} position={[-0.251006, 1.33, -2.231]} />
        <Mesh name="InBSupportR" geometry={nodes.InBSupportR.geometry} material={nodes.InBSupportR.material} position={[-0.251006, 1.33, -1.054]} />
        <Mesh name="InBTopShelve" geometry={nodes.InBTopShelve.geometry} material={nodes.InBTopShelve.material} position={[-0.221718, 1.706, -1.83]} />
        <Mesh name="InBTopShelve001" geometry={nodes.InBTopShelve001.geometry} material={nodes.InBTopShelve001.material} position={[-0.251, 2.301, -1.348]} />
        <Mesh name="InBTopShelve002" geometry={nodes.InBTopShelve002.geometry} material={nodes.InBTopShelve002.material} position={[-0.251, 2.326, -1.642]} />
        <Mesh name="InBTopShelve003" geometry={nodes.InBTopShelve003.geometry} material={nodes.InBTopShelve003.material} position={[-0.251006, 2.023, -1.6425]} />
        <Mesh name="InBTopShelve004" geometry={nodes.InBTopShelve004.geometry} material={nodes.InBTopShelve004.material} position={[-0.251, 2.301, -1.93646]} />
        <Mesh name="InBTopShelve005" geometry={nodes.InBTopShelve005.geometry} material={nodes.InBTopShelve005.material} position={[-0.221718, 1.853001, -2.0305]} />
        <Mesh name="InBTopShelve006" geometry={nodes.InBTopShelve006.geometry} material={nodes.InBTopShelve006.material} position={[-0.221718, 1.853, -1.642]} />
        <Mesh name="InBTopShelve007" geometry={nodes.InBTopShelve007.geometry} material={nodes.InBTopShelve007.material} position={[-0.221718, 1.407, -2.0305]} />
        <Mesh name="InBTopShelve008" geometry={nodes.InBTopShelve008.geometry} material={nodes.InBTopShelve008.material} position={[-0.221718, 1.653, -2.0305]} />
        <Mesh name="InBTopShelve010" geometry={nodes.InBTopShelve010.geometry} material={nodes.InBTopShelve010.material} position={[-0.221718, 1.653, -1.642]} />
        <Mesh name="InBTopShelve011" geometry={nodes.InBTopShelve011.geometry} material={nodes.InBTopShelve011.material} position={[-0.221718, 1.853001, -1.254]} />
        <Mesh name="InBTopShelve012" geometry={nodes.InBTopShelve012.geometry} material={nodes.InBTopShelve012.material} position={[-0.221718, 1.653, -1.254]} />
        <Mesh name="InBTopShelve013" geometry={nodes.InBTopShelve013.geometry} material={nodes.InBTopShelve013.material} position={[-0.221718, 1.706, -1.454]} />
        <Mesh name="InBTopShelve014" geometry={nodes.InBTopShelve014.geometry} material={nodes.InBTopShelve014.material} position={[-0.221718, 1.407, -1.2545]} />
        <Mesh name="InBTopLightsLEDL" geometry={nodes.InBTopLightsLEDL.geometry} material={nodes.InBTopLightsLEDL.material} position={[-0.4325, 1.9255, -2.2215]} />
        <Mesh name="InBTopLightsLERR" geometry={nodes.InBTopLightsLERR.geometry} material={nodes.InBTopLightsLERR.material} position={[-0.4325, 1.9255, -1.0635]} />
        <Mesh name="InBBottomSupportR" geometry={nodes.InBBottomSupportR.geometry} material={nodes.InBBottomSupportR.material} position={[-0.2852, 0.4312, -1.072]} />
        <Mesh name="InBBottomSupportTop" geometry={nodes.InBBottomSupportTop.geometry} material={nodes.InBBottomSupportTop.material} position={[-0.251006, 1.222, -1.6425]} />
        <Mesh name="InBBottomSupportMid" geometry={nodes.InBBottomSupportMid.geometry} material={nodes.InBBottomSupportMid.material} position={[-0.251, 0.19, -1.603]} />
        <Mesh name="InBBottomShelveL" geometry={nodes.InBBottomShelveL.geometry} material={nodes.InBBottomShelveL.material} position={[-0.251, 0.349, -1.908]} />
        <Mesh name="InBBottomSupportMid001" geometry={nodes.InBBottomSupportMid001.geometry} material={nodes.InBBottomSupportMid001.material} position={[-0.251, 0.7855, -1.603]} />
        <Mesh name="InBBottomSupportR001" geometry={nodes.InBBottomSupportR001.geometry} material={nodes.InBBottomSupportR001.material} position={[-0.264, 0.220857, -2.213]} />
        <Mesh name="InBBottomDrawersBigBR" geometry={nodes.InBBottomDrawersBigBR.geometry} material={nodes.InBBottomDrawersBigBR.material} position={[-0.3311, 0.150667, -1.3375]} />
        <Mesh name="InBBottomDrawersMediumR3" geometry={nodes.InBBottomDrawersMediumR3.geometry} material={nodes.InBBottomDrawersMediumR3.material} position={[-0.3311, 0.400667, -1.3375]} />
        <Mesh name="InBBottomDrawersMediumR3003" geometry={nodes.InBBottomDrawersMediumR3003.geometry} material={nodes.InBBottomDrawersMediumR3003.material} position={[-0.3311, 0.750667, -1.3375]} />
        <Mesh name="InBBottomDrawersLightsLEDTop" geometry={nodes.InBBottomDrawersLightsLEDTop.geometry} material={nodes.InBBottomDrawersLightsLEDTop.material} position={[-0.431365, 1.212507, -1.3375]} />
        <Mesh name="InBBottomDrawersMediumR3001" geometry={nodes.InBBottomDrawersMediumR3001.geometry} material={nodes.InBBottomDrawersMediumR3001.material} position={[-0.3311, 1.100667, -1.3375]} />
        <Mesh name="InBBottomDrawersMediumR3002" geometry={nodes.InBBottomDrawersMediumR3002.geometry} material={nodes.InBBottomDrawersMediumR3002.material} position={[-0.3311, 0.925667, -1.3375]} />
        <Mesh name="InBBottomDrawersMediumR3004" geometry={nodes.InBBottomDrawersMediumR3004.geometry} material={nodes.InBBottomDrawersMediumR3004.material} position={[-0.3311, 0.575667, -1.3375]} />
        <Mesh name="InBBottomDrawersBigBR001" geometry={nodes.InBBottomDrawersBigBR001.geometry} material={nodes.InBBottomDrawersBigBR001.material} position={[-0.3311, 0.150667, -1.908]} />
        <Mesh name="InBBottomDrawersBigBR002" geometry={nodes.InBBottomDrawersBigBR002.geometry} material={nodes.InBBottomDrawersBigBR002.material} position={[-0.3311, 0.150667, -0.8825]} />
        <Mesh name="InCSvelve" geometry={nodes.InCSvelve.geometry} material={nodes.InCSvelve.material} position={[-0.251, 0.349, -0.874]} />
        <Mesh name="InCSvelve001" geometry={nodes.InCSvelve001.geometry} material={nodes.InCSvelve001.material} position={[-0.2505, 0.699, -0.874]} />
        <Mesh name="InCSvelve002" geometry={nodes.InCSvelve002.geometry} material={nodes.InCSvelve002.material} position={[-0.251, 0.999, -0.874]} />
        <Mesh name="InCSvelve003" geometry={nodes.InCSvelve003.geometry} material={nodes.InCSvelve003.material} position={[-0.251, 1.301, -0.874]} />
        <Mesh name="InCSupportDrawerR" geometry={nodes.InCSupportDrawerR.geometry} material={nodes.InCSupportDrawerR.material} position={[-0.264, 0.220857, -0.712]} />
        <Mesh name="InCSupportR" geometry={nodes.InCSupportR.geometry} material={nodes.InCSupportR.material} position={[-0.251, 0.675, -0.694]} />
        <Mesh name="InCLightsLED" geometry={nodes.InCLightsLED.geometry} material={nodes.InCLightsLED.material} position={[-0.4325, 0.825, -0.7035]} />
        <Mesh name="InDSvelve" geometry={nodes.InDSvelve.geometry} material={nodes.InDSvelve.material} position={[-0.251006, 2.301, -0.3625]} />
        <Mesh name="InDSvelve001" geometry={nodes.InDSvelve001.geometry} material={nodes.InDSvelve001.material} position={[-0.251006, 1.749, -0.3625]} />
        <Mesh name="InDSvelve002" geometry={nodes.InDSvelve002.geometry} material={nodes.InDSvelve002.material} position={[-0.251006, 2.023, -0.3625]} />
        <Mesh name="InDSvelve003" geometry={nodes.InDSvelve003.geometry} material={nodes.InDSvelve003.material} position={[-0.251006, 2.611, -0.3625]} />
        <Mesh name="InDSvelve004" geometry={nodes.InDSvelve004.geometry} material={nodes.InDSvelve004.material} position={[-0.251006, 0.049, -0.3625]} />
        <Mesh name="InDShelveMini" geometry={nodes.InDShelveMini.geometry} material={nodes.InDShelveMini.material} position={[-0.164878, 0.9002, -0.198625]} />
        <Mesh name="InDLisgtsLEDR" geometry={nodes.InDLisgtsLEDR.geometry} material={nodes.InDLisgtsLEDR.material} position={[-0.4325, 1.33, -0.0405]} />
        <Mesh name="InDSupportMid001" geometry={nodes.InDSupportMid001.geometry} material={nodes.InDSupportMid001.material} position={[-0.3035, 1.2452, -0.136]} />
        <Mesh name="InDShelveMini001" geometry={nodes.InDShelveMini001.geometry} material={nodes.InDShelveMini001.material} position={[-0.164878, 1.1302, -0.191875]} />
        <Mesh name="InDShelveMini002" geometry={nodes.InDShelveMini002.geometry} material={nodes.InDShelveMini002.material} position={[-0.164878, 1.3602, -0.191875]} />
        <Mesh name="InDShelveMini003" geometry={nodes.InDShelveMini003.geometry} material={nodes.InDShelveMini003.material} position={[-0.164878, 1.5902, -0.198625]} />
        <Mesh name="InDSvelve005" geometry={nodes.InDSvelve005.geometry} material={nodes.InDSvelve005.material} position={[-0.251006, 0.067, -0.524591]} />
        <Mesh name="AShelves" geometry={nodes.AShelves.geometry} material={nodes.AShelves.material} position={[-0.270645, 0.895617, -2.478296]} />
        <Mesh name="AShelves002" geometry={nodes.AShelves002.geometry} material={nodes.AShelves002.material} position={[-0.285, 1.021537, -2.456775]} />
        <Mesh name="AShelves003" geometry={nodes.AShelves003.geometry} material={nodes.AShelves003.material} position={[-0.285, 1.421537, -2.456775]} />
        <Mesh name="AShelves004" geometry={nodes.AShelves004.geometry} material={nodes.AShelves004.material} position={[-0.285, 1.821537, -2.456775]} />
        <Mesh name="AShelves005" geometry={nodes.AShelves005.geometry} material={nodes.AShelves005.material} position={[-0.285, 2.221537, -2.456775]} />
      </group>
    </group>
  );
}

useGLTF.preload(path);
