'use client';

import { useTheme } from '@/lib/themes/themeContext';
import { themes, ThemeId } from '@/lib/themes/themeConfig';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

export default function ThemeSelector() {
  const { themeId, setTheme } = useTheme();

  const themeOptions: ThemeId[] = ['original', 'calimingo', 'apple'];

  return (
    <div className="flex items-center justify-center gap-2">
      <Select value={themeId} onValueChange={(value) => setTheme(value as ThemeId)}>
        <SelectTrigger className="w-[140px] h-8 text-xs">
          <SelectValue>
            <div className="flex items-center gap-2">
              <ThemeColorSwatch themeId={themeId} />
              <span>{themes[themeId].name}</span>
            </div>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {themeOptions.map((id) => {
            const theme = themes[id];
            return (
              <SelectItem key={id} value={id} className="cursor-pointer">
                <div className="flex items-center gap-2 w-full">
                  <ThemeColorSwatch themeId={id} />
                  <div className="flex flex-col flex-1">
                    <span className="text-sm font-medium">{theme.name}</span>
                    <span className="text-xs text-muted-foreground">{theme.description}</span>
                  </div>
                </div>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </div>
  );
}

function ThemeColorSwatch({ themeId }: { themeId: ThemeId }) {
  const theme = themes[themeId];
  const primaryColor = theme.colors.primary;

  // Convert HSL string to approximate color for swatch
  const getColorStyle = () => {
    // Parse HSL: "220 50% 30%" -> hsl(220, 50%, 30%)
    return {
      backgroundColor: `hsl(${primaryColor})`,
    };
  };

  return (
    <div
      className={cn(
        'h-4 w-4 rounded-full border border-border',
        themeId === 'original' && 'ring-1 ring-foreground/20'
      )}
      style={getColorStyle()}
      aria-hidden="true"
    />
  );
}
