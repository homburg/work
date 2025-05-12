import { Colors } from "@/constants/Colors";
import { useColorScheme } from "./useColorScheme";

export function useTheme() {
  const theme = useColorScheme();
  return Colors[theme ?? "dark"];
}
