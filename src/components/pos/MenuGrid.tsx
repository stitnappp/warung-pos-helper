import { useState } from 'react';
import { MenuItem, MenuCategory } from '@/types/pos';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Utensils, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MenuGridProps {
  items: MenuItem[];
  categories: MenuCategory[];
  onAddToCart: (item: MenuItem) => void;
}

export function MenuGrid({ items, categories, onAddToCart }: MenuGridProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const filteredItems = selectedCategory
    ? items.filter(item => item.category_id === selectedCategory)
    : items;

  const availableItems = filteredItems.filter(item => item.is_available);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(price);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Category Filter */}
      <div className="flex gap-2 pb-4 overflow-x-auto scrollbar-hide">
        <Button
          variant={selectedCategory === null ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSelectedCategory(null)}
          className="whitespace-nowrap"
        >
          Semua
        </Button>
        {categories.map(category => (
          <Button
            key={category.id}
            variant={selectedCategory === category.id ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedCategory(category.id)}
            className="whitespace-nowrap"
          >
            {category.name}
          </Button>
        ))}
      </div>

      {/* Menu Items Grid */}
      <div className="flex-1 overflow-y-auto">
        {availableItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <Utensils className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-lg font-medium">Belum ada menu</p>
            <p className="text-sm">Tambahkan menu di halaman admin</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {availableItems.map(item => (
              <Card
                key={item.id}
                className={cn(
                  "group cursor-pointer overflow-hidden transition-all duration-200",
                  "hover:shadow-lg hover:scale-[1.02] hover:border-primary/50",
                  "animate-fade-in"
                )}
                onClick={() => onAddToCart(item)}
              >
                <div className="aspect-square relative bg-muted overflow-hidden">
                  {item.image_url ? (
                    <img
                      src={item.image_url}
                      alt={item.name}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-secondary">
                      <Utensils className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-foreground/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                  <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <div className="bg-primary text-primary-foreground rounded-full p-2">
                      <Plus className="h-4 w-4" />
                    </div>
                  </div>
                </div>
                <div className="p-3">
                  <h3 className="font-semibold text-sm truncate">{item.name}</h3>
                  {item.description && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {item.description}
                    </p>
                  )}
                  <Badge variant="secondary" className="mt-2 font-bold">
                    {formatPrice(item.price)}
                  </Badge>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}