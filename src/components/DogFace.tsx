import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';

/** Ilustración de perro de la bienvenida, la misma del prototipo. */
export type DogLook = {
  fur: string;
  ear: string;
  accent: string;
  bg: string;
  spot?: string;
  tongue?: boolean;
  pointy?: boolean;
  collar?: string;
};

export const SAMPLE_DOGS: DogLook[] = [
  { fur: '#E0A458', ear: '#C98A3E', accent: '#F3D7A8', bg: '#7FB7A4', tongue: true },
  { fur: '#8A4B2A', ear: '#5E2F18', accent: '#C98B62', bg: '#F2B84B' },
  { fur: '#9AA5B4', ear: '#5F6B7C', accent: '#FFFFFF', bg: '#3B5BA5', pointy: true },
  { fur: '#F4F1F6', ear: '#E3DCE8', accent: '#FFFFFF', bg: '#E89BB0' },
  { fur: '#E8D2A6', ear: '#3A2F2A', accent: '#3A2F2A', bg: '#B98ED6', tongue: true },
];

export function DogFace({ look, size }: { look: DogLook; size: number }) {
  const ears = look.pointy ? (
    <>
      <Path d="M70 110 L84 30 L130 86 Z" fill={look.ear} />
      <Path d="M230 110 L216 30 L170 86 Z" fill={look.ear} />
      <Path d="M84 96 L90 52 L116 84 Z" fill={look.accent} opacity={0.55} />
      <Path d="M216 96 L210 52 L184 84 Z" fill={look.accent} opacity={0.55} />
    </>
  ) : (
    <>
      <Ellipse cx={62} cy={118} rx={26} ry={52} fill={look.ear} transform="rotate(18 62 118)" />
      <Ellipse cx={238} cy={118} rx={26} ry={52} fill={look.ear} transform="rotate(-18 238 118)" />
    </>
  );
  return (
    <Svg width={size} height={size} viewBox="0 30 300 300" accessible={false}>
      <Rect x={0} y={0} width={300} height={380} fill={look.bg} />
      <G transform="translate(0,40)">
        <Rect x={95} y={230} width={110} height={120} rx={50} fill={look.fur} />
        <Rect x={104} y={232} width={92} height={14} rx={7} fill={look.collar ?? '#F2634A'} />
        <Circle cx={150} cy={252} r={8} fill="#F4C542" />
        {ears}
        <Ellipse cx={150} cy={140} rx={92} ry={88} fill={look.fur} />
        {look.spot ? <Ellipse cx={112} cy={118} rx={28} ry={24} fill={look.spot} /> : null}
        <Ellipse cx={150} cy={186} rx={50} ry={40} fill={look.accent} />
        <Circle cx={115} cy={128} r={10} fill="#1B1B1F" />
        <Circle cx={185} cy={128} r={10} fill="#1B1B1F" />
        <Circle cx={118} cy={125} r={3.4} fill="#FFFFFF" />
        <Circle cx={188} cy={125} r={3.4} fill="#FFFFFF" />
        <Ellipse cx={150} cy={172} rx={17} ry={12} fill="#1B1B1F" />
        <Path
          d="M150 184 v14 M150 198 q-14 12 -26 2 M150 198 q14 12 26 2"
          stroke="#1B1B1F"
          strokeWidth={4}
          fill="none"
          strokeLinecap="round"
        />
        {look.tongue ? <Path d="M140 222 q10 26 20 0 z" fill="#F07C8A" /> : null}
      </G>
    </Svg>
  );
}
