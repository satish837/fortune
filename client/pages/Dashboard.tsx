import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Users, Mail, Phone, Calendar, RefreshCw, Download, LogOut, Lock } from "lucide-react";

interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  handle?: string;
  isVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

interface DashboardStats {
  totalUsers: number;
  verifiedUsers: number;
  recentUsers: number;
  totalToday: number;
}

// Static credentials for dashboard access
const STATIC_CREDENTIALS = {
  username: "admin",
  password: "diwali2025"
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    verifiedUsers: 0,
    recentUsers: 0,
    totalToday: 0
  });
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [error, setError] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginForm, setLoginForm] = useState({
    username: "",
    password: ""
  });
  const [loginError, setLoginError] = useState("");

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/users');
      const data = await response.json();
      
      if (response.ok) {
        setUsers(data.users || []);
        calculateStats(data.users || []);
        setError("");
      } else {
        setError(data.error || 'Failed to fetch users');
      }
    } catch (err) {
      setError('Network error. Please try again.');
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (userList: User[]) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const last7Days = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    const totalUsers = userList.length;
    const verifiedUsers = userList.filter(user => user.isVerified).length;
    const recentUsers = userList.filter(user => new Date(user.createdAt) >= last7Days).length;
    const totalToday = userList.filter(user => {
      const userDate = new Date(user.createdAt);
      return userDate >= today;
    }).length;

    setStats({
      totalUsers,
      verifiedUsers,
      recentUsers,
      totalToday
    });
  };

  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.handle && user.handle.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const exportUsers = () => {
    const csvContent = [
      ['Name', 'Email', 'Phone', 'Handle', 'Verified', 'Created At'],
      ...filteredUsers.map(user => [
        user.name,
        user.email,
        user.phone,
        user.handle || '',
        user.isVerified ? 'Yes' : 'No',
        formatDate(user.createdAt)
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `users-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Authentication check
  useEffect(() => {
    const checkAuth = () => {
      const dashboardAuth = localStorage.getItem('dashboardAuth');
      
      if (dashboardAuth === 'true') {
        // Static authentication found, allow access
        setIsAuthenticated(true);
        setAuthLoading(false);
      } else {
        // No authentication found, show login form
        setAuthLoading(false);
      }
    };

    checkAuth();
  }, []);

  // Logout function
  // Handle static login
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    
    if (loginForm.username === STATIC_CREDENTIALS.username && 
        loginForm.password === STATIC_CREDENTIALS.password) {
      setIsAuthenticated(true);
      setAuthLoading(false);
      // Store static auth in localStorage for persistence
      localStorage.setItem('dashboardAuth', 'true');
    } else {
      setLoginError("Invalid username or password");
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setAuthLoading(true);
    localStorage.removeItem('dashboardAuth');
    setLoginForm({ username: "", password: "" });
  };

  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      fetchUsers();
    }
  }, [isAuthenticated, authLoading]);

  // Show loading while checking authentication
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
          <p className="text-orange-700">Loading...</p>
        </div>
      </div>
    );
  }

  // Show login form if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50">
        <Card className="w-full max-w-md mx-4">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 p-3 bg-orange-100 rounded-full w-fit">
              <Lock className="h-8 w-8 text-orange-600" />
            </div>
            <CardTitle className="text-2xl font-bold text-orange-900">Dashboard Login</CardTitle>
            <CardDescription>
              Enter your credentials to access the user dashboard
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
                  Username
                </label>
                <Input
                  id="username"
                  type="text"
                  value={loginForm.username}
                  onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                  placeholder="Enter username"
                  required
                  className="w-full"
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <Input
                  id="password"
                  type="password"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                  placeholder="Enter password"
                  required
                  className="w-full"
                />
              </div>
              {loginError && (
                <div className="text-red-600 text-sm text-center bg-red-50 p-2 rounded">
                  {loginError}
                </div>
              )}
              <Button type="submit" className="w-full bg-orange-600 hover:bg-orange-700">
                Login to Dashboard
              </Button>
            </form>
           
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
          <p className="text-orange-700">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-orange-900 mb-2">User Dashboard</h1>
              <p className="text-orange-700">Manage and view user registrations</p>
            </div>
            <div className="flex gap-3">
              <Button
                onClick={fetchUsers}
                variant="outline"
                className="text-orange-600 border-orange-300 hover:bg-orange-50"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
              <Button
                onClick={exportUsers}
                className="bg-orange-600 hover:bg-orange-700"
              >
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
              <Button
                onClick={handleLogout}
                variant="outline"
                className="text-red-600 border-red-300 hover:bg-red-50"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="bg-white/80 backdrop-blur border-orange-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-orange-700">Total Users</CardTitle>
              <Users className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-900">{stats.totalUsers}</div>
              <p className="text-xs text-orange-600">All registered users</p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur border-orange-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-orange-700">Verified Users</CardTitle>
              <Mail className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-900">{stats.verifiedUsers}</div>
              <p className="text-xs text-orange-600">
                {stats.totalUsers > 0 ? Math.round((stats.verifiedUsers / stats.totalUsers) * 100) : 0}% verified
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur border-orange-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-orange-700">Recent Users</CardTitle>
              <Calendar className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-900">{stats.recentUsers}</div>
              <p className="text-xs text-orange-600">Last 7 days</p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur border-orange-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-orange-700">Today</CardTitle>
              <Phone className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-900">{stats.totalToday}</div>
              <p className="text-xs text-orange-600">New registrations</p>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filters */}
        <Card className="bg-white/80 backdrop-blur border-orange-200 mb-6">
          <CardHeader>
            <CardTitle className="text-orange-900">User Management</CardTitle>
            <CardDescription>Search and manage user registrations</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-orange-400 h-4 w-4" />
                <Input
                  placeholder="Search users by name, email, or handle..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 border-orange-200 focus:border-orange-400"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Error Message */}
        {error && (
          <Card className="bg-red-50 border-red-200 mb-6">
            <CardContent className="pt-6">
              <p className="text-red-600">{error}</p>
            </CardContent>
          </Card>
        )}

        {/* Users Table */}
        <Card className="bg-white/80 backdrop-blur border-orange-200">
          <CardHeader>
            <CardTitle className="text-orange-900">
              Users ({filteredUsers.length} of {users.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {filteredUsers.length === 0 ? (
              <div className="text-center py-8">
                <Users className="h-12 w-12 text-orange-300 mx-auto mb-4" />
                <p className="text-orange-600">
                  {searchTerm ? 'No users found matching your search.' : 'No users found.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-orange-200">
                      <TableHead className="text-orange-700">Name</TableHead>
                      <TableHead className="text-orange-700">Email</TableHead>
                      <TableHead className="text-orange-700">Phone</TableHead>
                      <TableHead className="text-orange-700">Handle</TableHead>
                      <TableHead className="text-orange-700">Status</TableHead>
                      <TableHead className="text-orange-700">Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((user) => (
                      <TableRow key={user.id} className="border-orange-100 hover:bg-orange-50/50">
                        <TableCell className="font-medium text-orange-900">
                          {user.name}
                        </TableCell>
                        <TableCell className="text-orange-700">{user.email}</TableCell>
                        <TableCell className="text-orange-700">{user.phone}</TableCell>
                        <TableCell className="text-orange-700">
                          {user.handle ? `@${user.handle}` : '-'}
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={user.isVerified ? "default" : "secondary"}
                            className={user.isVerified 
                              ? "bg-green-100 text-green-800 border-green-200" 
                              : "bg-gray-100 text-gray-800 border-gray-200"
                            }
                          >
                            {user.isVerified ? 'Verified' : 'Pending'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-orange-600 text-sm">
                          {formatDate(user.createdAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
