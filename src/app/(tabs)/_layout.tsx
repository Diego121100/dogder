import { Tabs } from 'expo-router';
import Svg, { Circle, Path } from 'react-native-svg';
import { PawIcon } from '@/components/ActionBar';
import { useMatchesBadge } from '@/lib/chat';
import { useModerationGate } from '@/lib/moderation';
import { fonts, useColors } from '@/theme';

function ChatIcon({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinejoin="round">
      <Path d="M4 5h16v11H9l-5 4z" />
    </Svg>
  );
}
function PersonIcon({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2}>
      <Circle cx={12} cy={8} r={4} />
      <Path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
    </Svg>
  );
}

/** Barra de pestañas de abajo: Descubrir · Matches · Mi perro. */
export default function TabsLayout() {
  const c = useColors();
  const badge = useMatchesBadge();
  useModerationGate(); // cuenta suspendida o advertencia pendiente
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.ink,
        tabBarInactiveTintColor: c.muted,
        tabBarStyle: { backgroundColor: c.bg, borderTopColor: c.line },
        tabBarLabelStyle: { fontFamily: fonts.bodyBold, fontSize: 11.5 },
        sceneStyle: { backgroundColor: c.bg },
      }}
    >
      <Tabs.Screen name="descubrir" options={{ title: 'Descubrir', tabBarIcon: ({ color }) => <PawIcon color={String(color)} size={24} /> }} />
      <Tabs.Screen
        name="matches"
        options={{
          title: 'Matches',
          tabBarIcon: ({ color }) => <ChatIcon color={String(color)} />,
          tabBarBadge: badge > 0 ? badge : undefined,
          tabBarBadgeStyle: { backgroundColor: c.coral, fontFamily: fonts.bodyBold, fontSize: 11 },
        }}
      />
      <Tabs.Screen name="mi-perro" options={{ title: 'Mi perro', tabBarIcon: ({ color }) => <PersonIcon color={String(color)} /> }} />
    </Tabs>
  );
}
