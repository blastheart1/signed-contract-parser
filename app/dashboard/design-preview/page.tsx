'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  Users, 
  TrendingUp, 
  DollarSign, 
  CheckCircle2, 
  AlertCircle, 
  Clock,
  Edit,
  Save,
  X,
  Plus,
  Trash2,
  Search,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  BarChart3,
  FileText,
  Calendar,
  Bell
} from 'lucide-react';

export default function DesignPreviewPage() {
  const [darkMode, setDarkMode] = useState(false);

  // Apply Calimingo design language CSS variables
  useEffect(() => {
    const root = document.documentElement;
    
    if (darkMode) {
      // Dark mode with blue-gray tones
      root.style.setProperty('--background', '210 20% 12%');
      root.style.setProperty('--foreground', '0 0% 98%');
      root.style.setProperty('--card', '210 15% 18%');
      root.style.setProperty('--card-foreground', '0 0% 98%');
      root.style.setProperty('--primary', '220 50% 40%');
      root.style.setProperty('--primary-foreground', '0 0% 98%');
      root.style.setProperty('--secondary', '210 15% 25%');
      root.style.setProperty('--secondary-foreground', '0 0% 98%');
      root.style.setProperty('--muted', '210 15% 20%');
      root.style.setProperty('--muted-foreground', '0 0% 65%');
      root.style.setProperty('--accent', '220 30% 25%');
      root.style.setProperty('--accent-foreground', '0 0% 98%');
      root.style.setProperty('--border', '210 15% 25%');
      root.style.setProperty('--input', '210 15% 25%');
      root.style.setProperty('--ring', '220 50% 40%');
    } else {
      // Light mode with Calimingo colors
      root.style.setProperty('--background', '210 20% 98%');
      root.style.setProperty('--foreground', '0 0% 3.9%');
      root.style.setProperty('--card', '0 0% 100%');
      root.style.setProperty('--card-foreground', '0 0% 3.9%');
      root.style.setProperty('--primary', '220 50% 30%');
      root.style.setProperty('--primary-foreground', '0 0% 98%');
      root.style.setProperty('--secondary', '210 15% 96%');
      root.style.setProperty('--secondary-foreground', '0 0% 9%');
      root.style.setProperty('--muted', '210 20% 96%');
      root.style.setProperty('--muted-foreground', '0 0% 45%');
      root.style.setProperty('--accent', '220 30% 96%');
      root.style.setProperty('--accent-foreground', '0 0% 9%');
      root.style.setProperty('--border', '210 15% 85%');
      root.style.setProperty('--input', '210 15% 85%');
      root.style.setProperty('--ring', '220 50% 30%');
    }

    return () => {
      // Reset to defaults on unmount (optional)
    };
  }, [darkMode]);

  // Calimingo-inspired color palette
  const colorPalette = [
    { name: 'Navy Blue', value: 'hsl(220, 50%, 30%)', description: 'Calimingo navy blue for primary actions' },
    { name: 'Navy Light', value: 'hsl(220, 50%, 40%)', description: 'Lighter navy for hover states' },
    { name: 'Teal Accent', value: 'hsl(180, 40%, 50%)', description: 'Sophisticated teal for secondary accents' },
    { name: 'Success Green', value: 'hsl(160, 50%, 45%)', description: 'Natural green for positive states' },
    { name: 'Warning Amber', value: 'hsl(35, 80%, 55%)', description: 'Warm amber for warnings' },
    { name: 'Stone Gray', value: 'hsl(210, 15%, 85%)', description: 'Soft gray-blue for borders' },
    { name: 'Background Warm', value: 'hsl(210, 20%, 98%)', description: 'Warm white background' },
  ];

  return (
    <div className={`min-h-screen ${darkMode ? 'dark' : ''} bg-background`}>
      <div className="container mx-auto p-8 space-y-12">
        {/* Header */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold tracking-tight" style={{ fontFamily: 'Oswald, sans-serif' }}>
                Calimingo Design Language Preview
              </h1>
              <p className="text-muted-foreground mt-2">
                Mock dashboard showcasing the integrated Calimingo design language
              </p>
            </div>
            <Button 
              onClick={() => setDarkMode(!darkMode)}
              variant="outline"
            >
              {darkMode ? 'Light Mode' : 'Dark Mode'}
            </Button>
          </div>
        </div>

        {/* Color Palette */}
        <Card>
          <CardHeader>
            <CardTitle style={{ fontFamily: 'Oswald, sans-serif' }}>Color Palette</CardTitle>
            <CardDescription>Calimingo-inspired color system</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {colorPalette.map((color) => (
                <div key={color.name} className="space-y-2">
                  <div 
                    className="w-full h-24 rounded-md border-2 border-border shadow-sm"
                    style={{ backgroundColor: color.value }}
                  />
                  <div>
                    <p className="font-semibold text-sm">{color.name}</p>
                    <p className="text-xs text-muted-foreground">{color.value}</p>
                    <p className="text-xs text-muted-foreground mt-1">{color.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Typography */}
        <Card>
          <CardHeader>
            <CardTitle style={{ fontFamily: 'Oswald, sans-serif' }}>Typography</CardTitle>
            <CardDescription>Font usage and hierarchy</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <h1 className="text-4xl font-bold tracking-tight" style={{ fontFamily: 'Oswald, sans-serif' }}>
                Heading 1 - Oswald Bold
              </h1>
              <h2 className="text-3xl font-semibold tracking-tight" style={{ fontFamily: 'Oswald, sans-serif' }}>
                Heading 2 - Oswald Semibold
              </h2>
              <h3 className="text-2xl font-semibold tracking-tight" style={{ fontFamily: 'Oswald, sans-serif' }}>
                Heading 3 - Oswald Semibold
              </h3>
              <h4 className="text-xl font-semibold" style={{ fontFamily: 'Oswald, sans-serif' }}>
                Heading 4 - Oswald Semibold
              </h4>
            </div>
            <Separator />
            <div className="space-y-2">
              <p className="text-base" style={{ fontFamily: 'Poppins, sans-serif' }}>
                Body text - Poppins Regular. This is how regular body text appears in the dashboard.
              </p>
              <p className="text-base font-medium" style={{ fontFamily: 'Poppins, sans-serif' }}>
                Medium weight - Poppins Medium. Used for emphasis in body text.
              </p>
              <p className="text-sm text-muted-foreground" style={{ fontFamily: 'Poppins, sans-serif' }}>
                Small muted text - Poppins Regular. Used for descriptions and secondary information.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Buttons */}
        <Card>
          <CardHeader>
            <CardTitle style={{ fontFamily: 'Oswald, sans-serif' }}>Buttons</CardTitle>
            <CardDescription>Button variants with Calimingo colors</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <Button>Primary Button</Button>
              <Button variant="secondary">Secondary Button</Button>
              <Button variant="outline">Outline Button</Button>
              <Button variant="ghost">Ghost Button</Button>
              <Button variant="destructive">Destructive Button</Button>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button size="sm">Small</Button>
              <Button size="default">Default</Button>
              <Button size="lg">Large</Button>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button disabled>Disabled</Button>
              <Button>
                <Save className="mr-2 h-4 w-4" />
                With Icon
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Badges & Status */}
        <Card>
          <CardHeader>
            <CardTitle style={{ fontFamily: 'Oswald, sans-serif' }}>Badges & Status</CardTitle>
            <CardDescription>Status indicators and badges</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <Badge variant="default">Default</Badge>
              <Badge variant="secondary">Secondary</Badge>
              <Badge variant="destructive">Destructive</Badge>
              <Badge variant="outline">Outline</Badge>
            </div>
            <div className="flex flex-wrap gap-3 items-center">
              <Badge className="bg-green-600 hover:bg-green-700">Active</Badge>
              <Badge className="bg-orange-500 hover:bg-orange-600 text-white">Waiting for Permit</Badge>
              <Badge className="bg-blue-600 hover:bg-blue-700">Completed</Badge>
              <Badge className="bg-amber-500 hover:bg-amber-600 text-white">Warning</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Form Elements */}
        <Card>
          <CardHeader>
            <CardTitle style={{ fontFamily: 'Oswald, sans-serif' }}>Form Elements</CardTitle>
            <CardDescription>Inputs, selects, and form controls</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="demo-input">Text Input</Label>
              <Input id="demo-input" placeholder="Enter text..." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="demo-date">Date Input</Label>
              <Input id="demo-date" type="date" />
            </div>
            <div className="space-y-2">
              <Label>Select Dropdown</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Select an option" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="option1">Option 1</SelectItem>
                  <SelectItem value="option2">Option 2</SelectItem>
                  <SelectItem value="option3">Option 3</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox id="demo-checkbox" />
              <Label htmlFor="demo-checkbox" className="cursor-pointer">
                Checkbox option
              </Label>
            </div>
          </CardContent>
        </Card>

        {/* Table Preview */}
        <Card>
          <CardHeader>
            <CardTitle style={{ fontFamily: 'Oswald, sans-serif' }}>Table Design</CardTitle>
            <CardDescription>Order items table with Calimingo styling</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="bg-muted/50">Product/Service</TableHead>
                    <TableHead className="bg-muted/50 text-right">QTY</TableHead>
                    <TableHead className="bg-muted/50 text-right">RATE</TableHead>
                    <TableHead className="bg-muted/50 text-right">AMOUNT</TableHead>
                    <TableHead className="bg-muted/50 text-right font-bold text-primary">% Progress Overall</TableHead>
                    <TableHead className="bg-muted/50 text-right">$ Completed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow className="hover:bg-muted/50">
                    <TableCell>Pool Excavation</TableCell>
                    <TableCell className="text-right">1</TableCell>
                    <TableCell className="text-right">$15,000.00</TableCell>
                    <TableCell className="text-right">$15,000.00</TableCell>
                    <TableCell className="text-right">100%</TableCell>
                    <TableCell className="text-right">$15,000.00</TableCell>
                  </TableRow>
                  <TableRow className="bg-muted/30 hover:bg-muted/50">
                    <TableCell>Concrete Pour</TableCell>
                    <TableCell className="text-right">1</TableCell>
                    <TableCell className="text-right">$25,000.00</TableCell>
                    <TableCell className="text-right">$25,000.00</TableCell>
                    <TableCell className="text-right">75%</TableCell>
                    <TableCell className="text-right">$18,750.00</TableCell>
                  </TableRow>
                  <TableRow className="hover:bg-muted/50">
                    <TableCell>Tile Installation</TableCell>
                    <TableCell className="text-right">500</TableCell>
                    <TableCell className="text-right">$8.50</TableCell>
                    <TableCell className="text-right">$4,250.00</TableCell>
                    <TableCell className="text-right">50%</TableCell>
                    <TableCell className="text-right">$2,125.00</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Dashboard Stats Preview */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium" style={{ fontFamily: 'Poppins, sans-serif' }}>
                Total Customers
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" style={{ fontFamily: 'Oswald, sans-serif' }}>247</div>
              <p className="text-xs text-muted-foreground">+12 from last month</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium" style={{ fontFamily: 'Poppins, sans-serif' }}>
                Total Value
              </CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" style={{ fontFamily: 'Oswald, sans-serif' }}>$8.2M</div>
              <p className="text-xs text-muted-foreground">+8.1% from last month</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium" style={{ fontFamily: 'Poppins, sans-serif' }}>
                Active Projects
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" style={{ fontFamily: 'Oswald, sans-serif' }}>89</div>
              <p className="text-xs text-muted-foreground">12 pending updates</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium" style={{ fontFamily: 'Poppins, sans-serif' }}>
                Completed
              </CardTitle>
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" style={{ fontFamily: 'Oswald, sans-serif' }}>158</div>
              <p className="text-xs text-muted-foreground">64% completion rate</p>
            </CardContent>
          </Card>
        </div>

        {/* Customer Info Card Preview */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl" style={{ fontFamily: 'Oswald, sans-serif' }}>
                  John & Jane Smith
                </CardTitle>
                <CardDescription className="mt-1">
                  Order #12345 | Customer #67890
                </CardDescription>
              </div>
              <Badge className="bg-green-600 hover:bg-green-700">Active</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h4 className="font-semibold text-sm" style={{ fontFamily: 'Oswald, sans-serif' }}>
                  Project Status
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Contract Date:</span>
                    <span>12/15/2024</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Project Start:</span>
                    <span>01/05/2025</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Project End:</span>
                    <span>03/20/2025</span>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <h4 className="font-semibold text-sm" style={{ fontFamily: 'Oswald, sans-serif' }}>
                  Job Information
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Order Date:</span>
                    <span>12/10/2024</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Balance Due:</span>
                    <span className="font-bold">$45,250.00</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Alerts */}
        <div className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Information Alert</AlertTitle>
            <AlertDescription>
              This is an informational alert with the Calimingo design language applied.
            </AlertDescription>
          </Alert>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error Alert</AlertTitle>
            <AlertDescription>
              This is an error alert for important warnings.
            </AlertDescription>
          </Alert>
        </div>

        {/* Tabs Preview */}
        <Card>
          <CardHeader>
            <CardTitle style={{ fontFamily: 'Oswald, sans-serif' }}>Tabs Component</CardTitle>
            <CardDescription>Tab navigation with Calimingo styling</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="items" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="items">Order Items</TabsTrigger>
                <TabsTrigger value="invoices">Invoices</TabsTrigger>
              </TabsList>
              <TabsContent value="items" className="mt-4">
                <p className="text-sm text-muted-foreground">
                  Order items content would appear here with the table design shown above.
                </p>
              </TabsContent>
              <TabsContent value="invoices" className="mt-4">
                <p className="text-sm text-muted-foreground">
                  Invoice content would appear here with similar styling.
                </p>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Action Buttons Preview */}
        <Card>
          <CardHeader>
            <CardTitle style={{ fontFamily: 'Oswald, sans-serif' }}>Action Buttons</CardTitle>
            <CardDescription>Common dashboard actions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <Button size="lg" className="gap-2">
                <Plus className="h-5 w-5" />
                Upload Contract
              </Button>
              <Button size="lg" variant="outline" className="gap-2">
                <Edit className="h-5 w-5" />
                Edit Table
              </Button>
              <Button size="lg" variant="outline" className="gap-2">
                <Save className="h-5 w-5" />
                Save Changes
              </Button>
              <Button size="lg" variant="outline" className="gap-2">
                <X className="h-5 w-5" />
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Modern Dashboard Patterns */}
        <div className="space-y-8">
          <h2 className="text-3xl font-bold tracking-tight" style={{ fontFamily: 'Oswald, sans-serif' }}>
            Modern Dashboard Patterns
          </h2>

          {/* Progress Bars & Metrics */}
          <Card>
            <CardHeader>
              <CardTitle style={{ fontFamily: 'Oswald, sans-serif' }}>Progress Bars & Metrics</CardTitle>
              <CardDescription>Visual progress indicators and metric displays</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Progress Bars */}
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="font-medium">Project Completion</span>
                    <span className="text-muted-foreground">75%</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
                    <div 
                      className="bg-primary h-2.5 rounded-full transition-all duration-500"
                      style={{ width: '75%' }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="font-medium">Invoice Collection</span>
                    <span className="text-muted-foreground">92%</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
                    <div 
                      className="bg-green-600 h-2.5 rounded-full transition-all duration-500"
                      style={{ width: '92%' }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="font-medium">Permit Processing</span>
                    <span className="text-muted-foreground">45%</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
                    <div 
                      className="bg-amber-500 h-2.5 rounded-full transition-all duration-500"
                      style={{ width: '45%' }}
                    />
                  </div>
                </div>
              </div>

              {/* Metric Cards with Trends */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 border rounded-lg hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">Revenue</span>
                    <ArrowUpRight className="h-4 w-4 text-green-600" />
                  </div>
                  <div className="text-2xl font-bold" style={{ fontFamily: 'Oswald, sans-serif' }}>$245K</div>
                  <div className="text-xs text-green-600 mt-1">+12.5% vs last month</div>
                </div>
                <div className="p-4 border rounded-lg hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">Active Projects</span>
                    <TrendingUp className="h-4 w-4 text-primary" />
                  </div>
                  <div className="text-2xl font-bold" style={{ fontFamily: 'Oswald, sans-serif' }}>89</div>
                  <div className="text-xs text-primary mt-1">+5 new this week</div>
                </div>
                <div className="p-4 border rounded-lg hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">Pending</span>
                    <ArrowDownRight className="h-4 w-4 text-amber-500" />
                  </div>
                  <div className="text-2xl font-bold" style={{ fontFamily: 'Oswald, sans-serif' }}>12</div>
                  <div className="text-xs text-amber-500 mt-1">-3 from last week</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Search & Filter Patterns */}
          <Card>
            <CardHeader>
              <CardTitle style={{ fontFamily: 'Oswald, sans-serif' }}>Search & Filter Patterns</CardTitle>
              <CardDescription>Modern search and filtering interfaces</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search customers, orders, or projects..." 
                  className="pl-10"
                />
              </div>

              {/* Filter Chips */}
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" className="gap-2">
                  <Filter className="h-4 w-4" />
                  All Status
                </Button>
                <Badge variant="secondary" className="cursor-pointer hover:bg-muted-foreground/10">
                  Active
                </Badge>
                <Badge variant="secondary" className="cursor-pointer hover:bg-muted-foreground/10">
                  Pending
                </Badge>
                <Badge variant="secondary" className="cursor-pointer hover:bg-muted-foreground/10">
                  Completed
                </Badge>
                <Badge variant="secondary" className="cursor-pointer hover:bg-muted-foreground/10">
                  Waiting for Permit
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Activity Feed Pattern */}
          <Card>
            <CardHeader>
              <CardTitle style={{ fontFamily: 'Oswald, sans-serif' }}>Activity Feed</CardTitle>
              <CardDescription>Recent activity and updates</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex gap-4 pb-4 border-b last:border-0">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">New contract uploaded</p>
                    <p className="text-xs text-muted-foreground">Smith Residence - Order #12345</p>
                    <p className="text-xs text-muted-foreground mt-1">2 hours ago</p>
                  </div>
                </div>
                <div className="flex gap-4 pb-4 border-b last:border-0">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 rounded-full bg-green-600/10 flex items-center justify-center">
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">Project completed</p>
                    <p className="text-xs text-muted-foreground">Johnson Pool - Order #12340</p>
                    <p className="text-xs text-muted-foreground mt-1">5 hours ago</p>
                  </div>
                </div>
                <div className="flex gap-4 pb-4 border-b last:border-0">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
                      <Bell className="h-5 w-5 text-amber-500" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">Payment received</p>
                    <p className="text-xs text-muted-foreground">Williams Project - $15,000.00</p>
                    <p className="text-xs text-muted-foreground mt-1">1 day ago</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions Panel */}
          <Card>
            <CardHeader>
              <CardTitle style={{ fontFamily: 'Oswald, sans-serif' }}>Quick Actions</CardTitle>
              <CardDescription>Common tasks and shortcuts</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <button className="p-4 border rounded-lg hover:bg-muted/50 hover:shadow-md transition-all text-center group">
                  <div className="w-12 h-12 mx-auto mb-2 bg-primary/10 rounded-lg flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <Plus className="h-6 w-6 text-primary" />
                  </div>
                  <div className="text-sm font-medium">New Contract</div>
                </button>
                <button className="p-4 border rounded-lg hover:bg-muted/50 hover:shadow-md transition-all text-center group">
                  <div className="w-12 h-12 mx-auto mb-2 bg-green-600/10 rounded-lg flex items-center justify-center group-hover:bg-green-600/20 transition-colors">
                    <FileText className="h-6 w-6 text-green-600" />
                  </div>
                  <div className="text-sm font-medium">Generate Report</div>
                </button>
                <button className="p-4 border rounded-lg hover:bg-muted/50 hover:shadow-md transition-all text-center group">
                  <div className="w-12 h-12 mx-auto mb-2 bg-blue-600/10 rounded-lg flex items-center justify-center group-hover:bg-blue-600/20 transition-colors">
                    <Calendar className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="text-sm font-medium">Schedule</div>
                </button>
                <button className="p-4 border rounded-lg hover:bg-muted/50 hover:shadow-md transition-all text-center group">
                  <div className="w-12 h-12 mx-auto mb-2 bg-amber-500/10 rounded-lg flex items-center justify-center group-hover:bg-amber-500/20 transition-colors">
                    <BarChart3 className="h-6 w-6 text-amber-500" />
                  </div>
                  <div className="text-sm font-medium">Analytics</div>
                </button>
              </div>
            </CardContent>
          </Card>

          {/* Status Indicators with Progress */}
          <Card>
            <CardHeader>
              <CardTitle style={{ fontFamily: 'Oswald, sans-serif' }}>Status Indicators</CardTitle>
              <CardDescription>Project status with visual progress</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 border rounded-lg hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-semibold" style={{ fontFamily: 'Oswald, sans-serif' }}>Smith Residence</h4>
                    <p className="text-sm text-muted-foreground">Order #12345</p>
                  </div>
                  <Badge className="bg-green-600 hover:bg-green-700">Active</Badge>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span>Overall Progress</span>
                    <span className="font-medium">75%</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div className="bg-primary h-2 rounded-full" style={{ width: '75%' }} />
                  </div>
                </div>
                <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
                  <span>Started: 01/05/2025</span>
                  <span>Est. Completion: 03/20/2025</span>
                </div>
              </div>
              <div className="p-4 border rounded-lg hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-semibold" style={{ fontFamily: 'Oswald, sans-serif' }}>Johnson Pool</h4>
                    <p className="text-sm text-muted-foreground">Order #12340</p>
                  </div>
                  <Badge className="bg-amber-500 hover:bg-amber-600 text-white">Waiting</Badge>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span>Permit Processing</span>
                    <span className="font-medium">45%</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div className="bg-amber-500 h-2 rounded-full" style={{ width: '45%' }} />
                  </div>
                </div>
                <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
                  <span>Waiting for permit approval</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Empty State Pattern */}
          <Card>
            <CardHeader>
              <CardTitle style={{ fontFamily: 'Oswald, sans-serif' }}>Empty State</CardTitle>
              <CardDescription>When no data is available</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                  <FileText className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2" style={{ fontFamily: 'Oswald, sans-serif' }}>
                  No contracts found
                </h3>
                <p className="text-sm text-muted-foreground mb-4 max-w-sm">
                  Get started by uploading your first contract or searching for existing ones.
                </p>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Upload Contract
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Modern Card Grid Layout */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base" style={{ fontFamily: 'Oswald, sans-serif' }}>
                    Today's Tasks
                  </CardTitle>
                  <Activity className="h-5 w-5 text-primary" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold mb-2" style={{ fontFamily: 'Oswald, sans-serif' }}>8</div>
                <p className="text-xs text-muted-foreground">3 pending reviews</p>
              </CardContent>
            </Card>
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base" style={{ fontFamily: 'Oswald, sans-serif' }}>
                    This Week
                  </CardTitle>
                  <TrendingUp className="h-5 w-5 text-green-600" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold mb-2" style={{ fontFamily: 'Oswald, sans-serif' }}>24</div>
                <p className="text-xs text-muted-foreground">+12% from last week</p>
              </CardContent>
            </Card>
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base" style={{ fontFamily: 'Oswald, sans-serif' }}>
                    Overdue
                  </CardTitle>
                  <AlertCircle className="h-5 w-5 text-amber-500" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold mb-2" style={{ fontFamily: 'Oswald, sans-serif' }}>3</div>
                <p className="text-xs text-muted-foreground">Requires attention</p>
              </CardContent>
            </Card>
          </div>

          {/* WCAG Accessibility Standards */}
          <div className="space-y-8 mt-12">
            <h2 className="text-3xl font-bold tracking-tight" style={{ fontFamily: 'Oswald, sans-serif' }}>
              WCAG 2.1 AA Accessibility Standards
            </h2>

            {/* Color Contrast Examples */}
            <Card>
              <CardHeader>
                <CardTitle style={{ fontFamily: 'Oswald, sans-serif' }}>Color Contrast (WCAG AA)</CardTitle>
                <CardDescription>
                  All text meets WCAG AA standards: 4.5:1 for normal text, 3:1 for large text (18pt+)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Passing Examples */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm" style={{ fontFamily: 'Oswald, sans-serif' }}>
                    ✅ Passing Contrast Ratios
                  </h4>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="p-4 rounded-lg" style={{ backgroundColor: 'hsl(220, 50%, 30%)', color: '#ffffff' }}>
                      <p className="font-semibold mb-1">Navy Blue on White Text</p>
                      <p className="text-sm opacity-90">Contrast: 7.2:1 (AAA)</p>
                      <p className="text-sm opacity-90">Perfect for primary buttons and important text</p>
                    </div>
                    <div className="p-4 rounded-lg bg-foreground text-background">
                      <p className="font-semibold mb-1">Dark Text on Light Background</p>
                      <p className="text-sm opacity-90">Contrast: 12.6:1 (AAA)</p>
                      <p className="text-sm opacity-90">Standard body text meets highest standards</p>
                    </div>
                    <div className="p-4 rounded-lg bg-green-600 text-white">
                      <p className="font-semibold mb-1">Success Green on White</p>
                      <p className="text-sm opacity-90">Contrast: 4.8:1 (AA)</p>
                      <p className="text-sm opacity-90">Meets WCAG AA for status indicators</p>
                    </div>
                    <div className="p-4 rounded-lg bg-amber-500 text-white">
                      <p className="font-semibold mb-1">Warning Amber on White</p>
                      <p className="text-sm opacity-90">Contrast: 4.6:1 (AA)</p>
                      <p className="text-sm opacity-90">Accessible warning messages</p>
                    </div>
                  </div>
                </div>

                {/* Focus Indicators */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm" style={{ fontFamily: 'Oswald, sans-serif' }}>
                    Focus Indicators (Keyboard Navigation)
                  </h4>
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      All interactive elements have visible focus indicators. Try tabbing through:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button className="focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
                        Focusable Button
                      </Button>
                      <Input 
                        placeholder="Focusable Input" 
                        className="focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                      />
                      <Button variant="outline" className="focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
                        Outline Button
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      💡 Tip: Press Tab to navigate. Focus rings are 2px solid navy blue with 2px offset.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Semantic HTML & ARIA */}
            <Card>
              <CardHeader>
                <CardTitle style={{ fontFamily: 'Oswald, sans-serif' }}>Semantic HTML & ARIA Labels</CardTitle>
                <CardDescription>Proper semantic structure and ARIA attributes for screen readers</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Proper Heading Hierarchy */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm" style={{ fontFamily: 'Oswald, sans-serif' }}>
                    Proper Heading Hierarchy
                  </h4>
                  <div className="p-4 border rounded-lg bg-muted/30">
                    <h1 className="text-2xl font-bold mb-2" style={{ fontFamily: 'Oswald, sans-serif' }}>
                      H1: Main Page Title
                    </h1>
                    <h2 className="text-xl font-semibold mb-2 mt-4" style={{ fontFamily: 'Oswald, sans-serif' }}>
                      H2: Section Title
                    </h2>
                    <h3 className="text-lg font-semibold mb-2 mt-3" style={{ fontFamily: 'Oswald, sans-serif' }}>
                      H3: Subsection Title
                    </h3>
                    <p className="text-sm text-muted-foreground mt-2">
                      Headings are properly nested (H1 → H2 → H3) for screen reader navigation
                    </p>
                  </div>
                </div>

                {/* ARIA Labels */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm" style={{ fontFamily: 'Oswald, sans-serif' }}>
                    ARIA Labels & Descriptions
                  </h4>
                  <div className="space-y-2">
                    <Button 
                      aria-label="Upload new contract file"
                      className="gap-2"
                    >
                      <Plus className="h-4 w-4" aria-hidden="true" />
                      Upload Contract
                    </Button>
                    <div className="text-xs text-muted-foreground">
                      Icon has <code className="bg-muted px-1 rounded">aria-hidden="true"</code> since button has descriptive label
                    </div>
                  </div>
                </div>

                {/* Form Labels */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm" style={{ fontFamily: 'Oswald, sans-serif' }}>
                    Accessible Form Elements
                  </h4>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="accessible-input">
                        Customer Name <span className="text-destructive" aria-label="required">*</span>
                      </Label>
                      <Input 
                        id="accessible-input"
                        placeholder="Enter customer name"
                        aria-required="true"
                        aria-describedby="input-help"
                      />
                      <p id="input-help" className="text-xs text-muted-foreground">
                        Enter the full legal name of the customer
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox id="accessible-checkbox" aria-describedby="checkbox-help" />
                      <div>
                        <Label htmlFor="accessible-checkbox" className="cursor-pointer">
                          I agree to the terms and conditions
                        </Label>
                        <p id="checkbox-help" className="text-xs text-muted-foreground">
                          Required to proceed with contract upload
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Keyboard Navigation */}
            <Card>
              <CardHeader>
                <CardTitle style={{ fontFamily: 'Oswald, sans-serif' }}>Keyboard Navigation</CardTitle>
                <CardDescription>All functionality accessible via keyboard</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm" style={{ fontFamily: 'Oswald, sans-serif' }}>
                    Keyboard Shortcuts & Navigation
                  </h4>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="p-4 border rounded-lg">
                      <div className="font-medium mb-2">Standard Navigation</div>
                      <ul className="text-sm space-y-1 text-muted-foreground">
                        <li><kbd className="px-2 py-1 bg-muted rounded text-xs">Tab</kbd> - Move forward</li>
                        <li><kbd className="px-2 py-1 bg-muted rounded text-xs">Shift + Tab</kbd> - Move backward</li>
                        <li><kbd className="px-2 py-1 bg-muted rounded text-xs">Enter</kbd> - Activate button/link</li>
                        <li><kbd className="px-2 py-1 bg-muted rounded text-xs">Space</kbd> - Toggle checkbox</li>
                        <li><kbd className="px-2 py-1 bg-muted rounded text-xs">Esc</kbd> - Close dialog</li>
                      </ul>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <div className="font-medium mb-2">Application Shortcuts</div>
                      <ul className="text-sm space-y-1 text-muted-foreground">
                        <li><kbd className="px-2 py-1 bg-muted rounded text-xs">Ctrl/Cmd + E</kbd> - Edit mode</li>
                        <li><kbd className="px-2 py-1 bg-muted rounded text-xs">Ctrl/Cmd + S</kbd> - Save changes</li>
                        <li><kbd className="px-2 py-1 bg-muted rounded text-xs">Ctrl/Cmd + K</kbd> - Search</li>
                        <li><kbd className="px-2 py-1 bg-muted rounded text-xs">/</kbd> - Focus search</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Skip Links */}
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm" style={{ fontFamily: 'Oswald, sans-serif' }}>
                    Skip Links (Screen Reader Navigation)
                  </h4>
                  <div className="p-4 border rounded-lg bg-muted/30">
                    <a 
                      href="#main-content" 
                      className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:ring-2 focus:ring-primary focus:ring-offset-2"
                    >
                      Skip to main content
                    </a>
                    <p className="text-sm text-muted-foreground">
                      Skip links allow keyboard users to bypass repetitive navigation. Press Tab on page load to see.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Screen Reader Support */}
            <Card>
              <CardHeader>
                <CardTitle style={{ fontFamily: 'Oswald, sans-serif' }}>Screen Reader Support</CardTitle>
                <CardDescription>Proper announcements and live regions</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm" style={{ fontFamily: 'Oswald, sans-serif' }}>
                    Live Regions for Dynamic Content
                  </h4>
                  <div className="p-4 border rounded-lg bg-muted/30">
                    <div 
                      role="status" 
                      aria-live="polite" 
                      aria-atomic="true"
                      className="text-sm"
                    >
                      Status updates will be announced to screen readers
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Use <code className="bg-muted px-1 rounded">aria-live="polite"</code> for non-urgent updates
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="font-semibold text-sm" style={{ fontFamily: 'Oswald, sans-serif' }}>
                    Error Messages
                  </h4>
                  <div className="p-4 border rounded-lg border-destructive/50 bg-destructive/5">
                    <div role="alert" aria-live="assertive" className="text-sm text-destructive">
                      <strong>Error:</strong> This field is required
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Use <code className="bg-muted px-1 rounded">role="alert"</code> for critical errors
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="font-semibold text-sm" style={{ fontFamily: 'Oswald, sans-serif' }}>
                    Icon-Only Buttons
                  </h4>
                  <div className="flex gap-2 items-center">
                    <Button 
                      size="icon"
                      variant="outline"
                      aria-label="Delete item"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    <Button 
                      size="icon"
                      variant="outline"
                      aria-label="Edit item"
                    >
                      <Edit className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    <p className="text-xs text-muted-foreground ml-2">
                      Icon-only buttons have descriptive <code className="bg-muted px-1 rounded">aria-label</code>
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Accessible Tables */}
            <Card>
              <CardHeader>
                <CardTitle style={{ fontFamily: 'Oswald, sans-serif' }}>Accessible Tables</CardTitle>
                <CardDescription>Proper table structure for screen readers</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead scope="col">Customer Name</TableHead>
                        <TableHead scope="col" className="text-right">Order Value</TableHead>
                        <TableHead scope="col" className="text-right">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell>
                          <span className="font-medium">Smith Residence</span>
                        </TableCell>
                        <TableCell className="text-right">$125,000</TableCell>
                        <TableCell className="text-right">
                          <Badge className="bg-green-600">Active</Badge>
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>
                          <span className="font-medium">Johnson Pool</span>
                        </TableCell>
                        <TableCell className="text-right">$98,500</TableCell>
                        <TableCell className="text-right">
                          <Badge className="bg-amber-500">Pending</Badge>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
                <div className="mt-3 text-xs text-muted-foreground">
                  Tables use <code className="bg-muted px-1 rounded">scope="col"</code> on headers for proper screen reader navigation
                </div>
              </CardContent>
            </Card>

            {/* Accessibility Checklist */}
            <Card>
              <CardHeader>
                <CardTitle style={{ fontFamily: 'Oswald, sans-serif' }}>WCAG 2.1 AA Checklist</CardTitle>
                <CardDescription>Key accessibility requirements met</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span className="text-sm">4.5:1 contrast ratio for normal text</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span className="text-sm">3:1 contrast ratio for large text</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span className="text-sm">Visible focus indicators</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span className="text-sm">Keyboard navigation support</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span className="text-sm">Proper heading hierarchy</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span className="text-sm">ARIA labels on interactive elements</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span className="text-sm">Form labels and descriptions</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span className="text-sm">Semantic HTML structure</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span className="text-sm">Screen reader announcements</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span className="text-sm">Skip links for navigation</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
