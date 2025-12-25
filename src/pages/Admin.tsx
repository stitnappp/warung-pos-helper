import { useState, useEffect } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useIsAdmin } from '@/hooks/useUserRole';
import { 
  useMenuItems, 
  useMenuCategories, 
  useCreateMenuItem, 
  useUpdateMenuItem, 
  useDeleteMenuItem,
  useCreateCategory 
} from '@/hooks/useMenuItems';
import { useTables, useCreateTable, useUpdateTable } from '@/hooks/useTables';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Store, ArrowLeft, Plus, Pencil, Trash2, Utensils, 
  Grid3X3, Loader2, UtensilsCrossed, BarChart3, Settings
} from 'lucide-react';
import { MenuItem, MenuCategory, RestaurantTable } from '@/types/pos';
import { toast } from 'sonner';
import { SalesReport } from '@/components/pos/SalesReport';
import { TelegramSettings } from '@/components/pos/TelegramSettings';
import { MidtransSettings } from '@/components/pos/MidtransSettings';

export default function Admin() {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, isLoading: roleLoading } = useIsAdmin();
  const { data: menuItems = [], isLoading: itemsLoading } = useMenuItems();
  const { data: categories = [], isLoading: categoriesLoading } = useMenuCategories();
  const { data: tables = [], isLoading: tablesLoading } = useTables();
  
  const createMenuItem = useCreateMenuItem();
  const updateMenuItem = useUpdateMenuItem();
  const deleteMenuItem = useDeleteMenuItem();
  const createCategory = useCreateCategory();
  const createTable = useCreateTable();
  const updateTable = useUpdateTable();

  const [menuDialogOpen, setMenuDialogOpen] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [tableDialogOpen, setTableDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);

  if (authLoading || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (!isAdmin) {
    toast.error('Akses ditolak. Halaman ini hanya untuk admin.');
    return <Navigate to="/" replace />;
  }

  const isLoading = itemsLoading || categoriesLoading || tablesLoading;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
        <div className="container flex h-14 items-center px-4">
          <Button variant="ghost" size="icon" asChild className="mr-3">
            <Link to="/">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Store className="h-4 w-4 text-primary-foreground" />
            </div>
            <h1 className="font-bold text-lg">Admin Panel</h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container px-4 py-6">
        <Tabs defaultValue="menu" className="space-y-6">
          <TabsList className="grid w-full max-w-xl grid-cols-5">
            <TabsTrigger value="menu" className="gap-2">
              <Utensils className="h-4 w-4" />
              <span className="hidden sm:inline">Menu</span>
            </TabsTrigger>
            <TabsTrigger value="categories" className="gap-2">
              <Grid3X3 className="h-4 w-4" />
              <span className="hidden sm:inline">Kategori</span>
            </TabsTrigger>
            <TabsTrigger value="tables" className="gap-2">
              <UtensilsCrossed className="h-4 w-4" />
              <span className="hidden sm:inline">Meja</span>
            </TabsTrigger>
            <TabsTrigger value="reports" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Laporan</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Pengaturan</span>
            </TabsTrigger>
          </TabsList>

          {/* Menu Tab */}
          <TabsContent value="menu" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Daftar Menu</h2>
              <Button onClick={() => { setEditingItem(null); setMenuDialogOpen(true); }} className="gradient-primary">
                <Plus className="h-4 w-4 mr-2" /> Tambah Menu
              </Button>
            </div>
            
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <Skeleton key={i} className="h-32 rounded-lg" />
                ))}
              </div>
            ) : menuItems.length === 0 ? (
              <Card className="py-12">
                <div className="text-center text-muted-foreground">
                  <Utensils className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Belum ada menu</p>
                  <p className="text-sm">Klik "Tambah Menu" untuk menambahkan</p>
                </div>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {menuItems.map(item => (
                  <Card key={item.id} className="overflow-hidden">
                    <div className="flex">
                      <div className="w-24 h-24 bg-muted flex-shrink-0 flex items-center justify-center">
                        {item.image_url ? (
                          <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                        ) : (
                          <Utensils className="h-8 w-8 text-muted-foreground" />
                        )}
                      </div>
                      <CardContent className="flex-1 p-3 flex flex-col justify-between">
                        <div>
                          <h3 className="font-medium text-sm line-clamp-1">{item.name}</h3>
                          <p className="text-xs text-muted-foreground line-clamp-1">{item.description}</p>
                          <p className="text-sm font-semibold text-primary mt-1">
                            Rp {item.price.toLocaleString('id-ID')}
                          </p>
                        </div>
                        <div className="flex gap-1 mt-2">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-7 w-7"
                            onClick={() => { setEditingItem(item); setMenuDialogOpen(true); }}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-7 w-7 text-destructive"
                            onClick={() => {
                              if (confirm('Hapus menu ini?')) {
                                deleteMenuItem.mutate(item.id);
                              }
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </CardContent>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Categories Tab */}
          <TabsContent value="categories" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Daftar Kategori</h2>
              <Button onClick={() => setCategoryDialogOpen(true)} className="gradient-primary">
                <Plus className="h-4 w-4 mr-2" /> Tambah Kategori
              </Button>
            </div>
            
            {categoriesLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-20 rounded-lg" />
                ))}
              </div>
            ) : categories.length === 0 ? (
              <Card className="py-12">
                <div className="text-center text-muted-foreground">
                  <Grid3X3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Belum ada kategori</p>
                  <p className="text-sm">Klik "Tambah Kategori" untuk menambahkan</p>
                </div>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {categories.map(category => (
                  <Card key={category.id} className="p-4">
                    <h3 className="font-medium">{category.name}</h3>
                    {category.description && (
                      <p className="text-sm text-muted-foreground mt-1">{category.description}</p>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Tables Tab */}
          <TabsContent value="tables" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Daftar Meja</h2>
              <Button onClick={() => setTableDialogOpen(true)} className="gradient-primary">
                <Plus className="h-4 w-4 mr-2" /> Tambah Meja
              </Button>
            </div>
            
            {tablesLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map(i => (
                  <Skeleton key={i} className="h-24 rounded-lg" />
                ))}
              </div>
            ) : tables.length === 0 ? (
              <Card className="py-12">
                <div className="text-center text-muted-foreground">
                  <UtensilsCrossed className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Belum ada meja</p>
                  <p className="text-sm">Klik "Tambah Meja" untuk menambahkan</p>
                </div>
              </Card>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {tables.map(table => (
                  <Card key={table.id} className="p-4 text-center">
                    <h3 className="font-bold text-lg">Meja {table.table_number}</h3>
                    <p className="text-sm text-muted-foreground">Kapasitas: {table.capacity}</p>
                    <div className="mt-2">
                      <Select 
                        value={table.status} 
                        onValueChange={(status) => updateTable.mutate({ id: table.id, status: status as RestaurantTable['status'] })}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="available">Tersedia</SelectItem>
                          <SelectItem value="occupied">Terisi</SelectItem>
                          <SelectItem value="reserved">Dipesan</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Reports Tab */}
          <TabsContent value="reports" className="space-y-4">
            <h2 className="text-xl font-semibold">Laporan Penjualan</h2>
            <SalesReport />
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-6">
            <h2 className="text-xl font-semibold">Pengaturan</h2>
            <MidtransSettings />
            <TelegramSettings />
          </TabsContent>
        </Tabs>
      </main>

      {/* Menu Dialog */}
      <MenuDialog
        open={menuDialogOpen}
        onClose={() => setMenuDialogOpen(false)}
        editingItem={editingItem}
        categories={categories}
        onCreate={createMenuItem.mutateAsync}
        onUpdate={updateMenuItem.mutateAsync}
        isLoading={createMenuItem.isPending || updateMenuItem.isPending}
      />

      {/* Category Dialog */}
      <CategoryDialog
        open={categoryDialogOpen}
        onClose={() => setCategoryDialogOpen(false)}
        onCreate={createCategory.mutateAsync}
        isLoading={createCategory.isPending}
      />

      {/* Table Dialog */}
      <TableDialog
        open={tableDialogOpen}
        onClose={() => setTableDialogOpen(false)}
        onCreate={createTable.mutateAsync}
        isLoading={createTable.isPending}
      />
    </div>
  );
}

// Menu Dialog Component
function MenuDialog({
  open,
  onClose,
  editingItem,
  categories,
  onCreate,
  onUpdate,
  isLoading,
}: {
  open: boolean;
  onClose: () => void;
  editingItem: MenuItem | null;
  categories: MenuCategory[];
  onCreate: (data: any) => Promise<any>;
  onUpdate: (data: any) => Promise<any>;
  isLoading: boolean;
}) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [categoryId, setCategoryId] = useState('');

  useEffect(() => {
    if (open) {
      if (editingItem) {
        setName(editingItem.name);
        setPrice(editingItem.price.toString());
        setCategoryId(editingItem.category_id || '');
      } else {
        setName('');
        setPrice('');
        setCategoryId('');
      }
    }
  }, [open, editingItem]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const data = {
      name,
      price: parseFloat(price),
      category_id: categoryId || null,
      is_available: true,
    };

    try {
      if (editingItem) {
        await onUpdate({ id: editingItem.id, ...data });
      } else {
        await onCreate(data);
      }
      onClose();
      setName('');
      setPrice('');
      setCategoryId('');
    } catch (error) {
      // Error handled by mutation
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editingItem ? 'Edit Menu' : 'Tambah Menu'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nama Produk *</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Masukkan nama produk" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="category">Kategori</Label>
            <Select value={categoryId || "none"} onValueChange={(val) => setCategoryId(val === "none" ? "" : val)}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih kategori" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Tanpa Kategori</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="price">Harga *</Label>
            <Input id="price" type="number" value={price} onChange={(e) => setPrice(e.target.value)} required min={0} placeholder="Masukkan harga" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Batal</Button>
            <Button type="submit" className="gradient-primary" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingItem ? 'Update' : 'Tambah'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Category Dialog Component
function CategoryDialog({
  open,
  onClose,
  onCreate,
  isLoading,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (data: any) => Promise<any>;
  isLoading: boolean;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await onCreate({ name, description: description || null });
      onClose();
      setName('');
      setDescription('');
    } catch (error) {
      // Error handled by mutation
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Tambah Kategori</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="catName">Nama Kategori *</Label>
            <Input id="catName" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="catDesc">Deskripsi</Label>
            <Textarea id="catDesc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Batal</Button>
            <Button type="submit" className="gradient-primary" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Tambah
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Table Dialog Component
function TableDialog({
  open,
  onClose,
  onCreate,
  isLoading,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (data: any) => Promise<any>;
  isLoading: boolean;
}) {
  const [tableNumber, setTableNumber] = useState('');
  const [capacity, setCapacity] = useState('4');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await onCreate({ 
        table_number: tableNumber, 
        capacity: parseInt(capacity), 
        status: 'available' 
      });
      onClose();
      setTableNumber('');
      setCapacity('4');
    } catch (error) {
      // Error handled by mutation
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Tambah Meja</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tableNum">Nomor Meja *</Label>
            <Input id="tableNum" value={tableNumber} onChange={(e) => setTableNumber(e.target.value)} required placeholder="1, 2, A1, dll" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tableCap">Kapasitas</Label>
            <Input id="tableCap" type="number" value={capacity} onChange={(e) => setCapacity(e.target.value)} min={1} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Batal</Button>
            <Button type="submit" className="gradient-primary" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Tambah
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
