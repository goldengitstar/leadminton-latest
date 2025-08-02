import React, { useEffect, useState } from 'react';
import { useAdmin } from '../../contexts/AdminContext';
import { supabase } from '../../lib/supabase';
import { Plus, Search, Filter, Edit, Trash2, Zap, Shield, Shirt, ChevronsUp, X, Image as ImageIcon, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { FaShoePrints } from 'react-icons/fa';
import { GiShorts, GiTennisRacket } from 'react-icons/gi';

interface Equipment {
  id: string;
  name: string;
  description: string;
  type: 'racket' | 'shoes' | 'strings' | 'shirt' | 'shorts';
  image_url: string | null;
  price_coins: number;
  price_diamonds: number;
  price_shuttlecocks: number;
  endurance_boost: number;
  strength_boost: number;
  agility_boost: number;
  speed_boost: number;
  explosiveness_boost: number;
  injury_prevention_boost: number;
  smash_boost: number;
  defense_boost: number;
  serve_boost: number;
  stick_boost: number;
  slice_boost: number;
  drop_boost: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface AdminEquipmentManagementProps {}

const AdminEquipmentManagement: React.FC<AdminEquipmentManagementProps> = () => {
  const { logActivity } = useAdmin();
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState<Equipment | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'racket' as Equipment['type'],
    image_url: null as string | null,
    price_coins: 0,
    price_diamonds: 0,
    price_shuttlecocks: 0,
    endurance_boost: 0,
    strength_boost: 0,
    agility_boost: 0,
    speed_boost: 0,
    explosiveness_boost: 0,
    injury_prevention_boost: 0,
    smash_boost: 0,
    defense_boost: 0,
    serve_boost: 0,
    stick_boost: 0,
    slice_boost: 0,
    drop_boost: 0,
    is_active: true
  });

  useEffect(() => {
    loadEquipments();
    logActivity('equipment_viewed');
  }, []);

  const loadEquipments = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('equipment')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading equipment:', error);
        toast.error('Failed to load equipment. Please try again.');
        return;
      }

      setEquipments(data || []);
    } catch (error) {
      console.error('Error loading equipment:', error);
      toast.error('Failed to load equipment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateEquipment = () => {
    setEditingEquipment(null);
    setFormData({
      name: '',
      description: '',
      type: 'racket',
      image_url: null,
      price_coins: 0,
      price_diamonds: 0,
      price_shuttlecocks: 0,
      endurance_boost: 0,
      strength_boost: 0,
      agility_boost: 0,
      speed_boost: 0,
      explosiveness_boost: 0,
      injury_prevention_boost: 0,
      smash_boost: 0,
      defense_boost: 0,
      serve_boost: 0,
      stick_boost: 0,
      slice_boost: 0,
      drop_boost: 0,
      is_active: true
    });
    setImagePreview(null);
    setShowCreateForm(true);
  };

  const handleEditEquipment = (equipment: Equipment) => {
    setEditingEquipment(equipment);
    setFormData({
      name: equipment.name,
      description: equipment.description,
      type: equipment.type,
      image_url: equipment.image_url,
      price_coins: equipment.price_coins,
      price_diamonds: equipment.price_diamonds,
      price_shuttlecocks: equipment.price_shuttlecocks,
      endurance_boost: equipment.endurance_boost,
      strength_boost: equipment.strength_boost,
      agility_boost: equipment.agility_boost,
      speed_boost: equipment.speed_boost,
      explosiveness_boost: equipment.explosiveness_boost,
      injury_prevention_boost: equipment.injury_prevention_boost,
      smash_boost: equipment.smash_boost,
      defense_boost: equipment.defense_boost,
      serve_boost: equipment.serve_boost,
      stick_boost: equipment.stick_boost,
      slice_boost: equipment.slice_boost,
      drop_boost: equipment.drop_boost,
      is_active: equipment.is_active
    });
    setImagePreview(equipment.image_url);
    setShowCreateForm(true);
  };

  const handleDeleteEquipment = async (id: string) => {
    if (!confirm('Are you sure you want to delete this equipment? This action cannot be undone.')) return;

    try {
      setLoading(true);
      const { error } = await supabase
        .from('equipment')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting equipment:', error);
        toast.error('Failed to delete equipment. Please try again.');
        return;
      }

      await logActivity('equipment_deleted', 'equipment', id);
      loadEquipments();
      toast.success('Equipment deleted successfully');
    } catch (error) {
      console.error('Error deleting equipment:', error);
      toast.error('Failed to delete equipment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file type
    if (!file.type.match('image.*')) {
      toast.error('Please upload an image file');
      return;
    }

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size should be less than 5MB');
      return;
    }

    try {
      setImageUploading(true);
      
      // Generate unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `equipment/${fileName}`;

      // Upload image to Supabase Storage
      const { data, error } = await supabase.storage
        .from('equipment-images')
        .upload(filePath, file);

      if (error) {
        throw error;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('equipment-images')
        .getPublicUrl(filePath);

      // Set preview and form data
      setImagePreview(publicUrl);
      setFormData(prev => ({ ...prev, image_url: publicUrl }));

      toast.success('Image uploaded successfully');
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('Failed to upload image. Please try again.');
    } finally {
      setImageUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (editingEquipment) {
        // Update existing equipment
        const { error } = await supabase
          .from('equipment')
          .update({
            ...formData,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingEquipment.id);

        if (error) {
          console.error('Error updating equipment:', error);
          toast.error('Failed to update equipment. Please try again.');
          return;
        }

        await logActivity('equipment_updated', 'equipment', editingEquipment.id);
        toast.success('Equipment updated successfully');
      } else {
        // Create new equipment
        const { data, error } = await supabase
          .from('equipment')
          .insert(formData)
          .select()
          .single();

        if (error) {
          console.error('Error creating equipment:', error);
          toast.error('Failed to create equipment. Please try again.');
          return;
        }

        await logActivity('equipment_created', 'equipment', data.id);
        toast.success('Equipment created successfully');
      }

      setShowCreateForm(false);
      loadEquipments();
    } catch (error) {
      console.error('Error saving equipment:', error);
      toast.error('Failed to save equipment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const filteredEquipments = equipments.filter(equipment => {
    const matchesSearch = equipment.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         equipment.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || equipment.type === filterType;
    return matchesSearch && matchesType;
  });

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'racket': return <GiTennisRacket className="w-5 h-5" />;
      case 'shoes': return <FaShoePrints className="w-5 h-5" />;
      case 'shirt': return <Shirt className="w-5 h-5" />;
      case 'shorts': return <Shirt className="w-5 h-5" />;
      case 'strings': return <Zap className="w-5 h-5" />;
      default: return <Shield className="w-5 h-5" />;
    }
  };

  const getTypeName = (type: string) => {
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  const getStatColor = (value: number) => {
    if (value > 0) return 'text-green-600';
    if (value < 0) return 'text-red-600';
    return 'text-gray-500';
  };

  const formatPrice = (equipment: Equipment) => {
    const prices = [];
    if (equipment.price_coins > 0) prices.push(`${equipment.price_coins} coins`);
    if (equipment.price_diamonds > 0) prices.push(`${equipment.price_diamonds} diamonds`);
    if (equipment.price_shuttlecocks > 0) prices.push(`${equipment.price_shuttlecocks} shuttlecocks`);
    return prices.join(' + ') || 'Free';
  };

  if (loading && equipments.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Equipment Management</h1>
          <p className="text-gray-600">Create and manage equipment items</p>
        </div>
        <button
          onClick={handleCreateEquipment}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Equipment
        </button>
      </div>

      {/* Updated Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <GiTennisRacket className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Rackets</p>
              <p className="text-2xl font-bold text-gray-900">
                {equipments.filter(e => e.type === 'racket').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <FaShoePrints className="w-6 h-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Shoes</p>
              <p className="text-2xl font-bold text-gray-900">
                {equipments.filter(e => e.type === 'shoes').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Shirt className="w-6 h-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Shirts</p>
              <p className="text-2xl font-bold text-gray-900">
                {equipments.filter(e => e.type === 'shirt').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <GiShorts className="w-6 h-6 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Shorts</p>
              <p className="text-2xl font-bold text-gray-900">
                {equipments.filter(e => e.type === 'shorts').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-red-100 rounded-lg">
              <Zap className="w-6 h-6 text-red-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Strings</p>
              <p className="text-2xl font-bold text-gray-900">
                {equipments.filter(e => e.type === 'strings').length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search equipment..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full"
              />
            </div>
          </div>

          {/* Type Filter */}
          <div className="w-full sm:w-48">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Types</option>
              <option value="racket">Racket</option>
              <option value="shoes">Shoes</option>
              <option value="strings">Strings</option>
              <option value="shirt">Shirt</option>
              <option value="shorts">Shorts</option>
            </select>
          </div>
        </div>
      </div>

      {/* Equipment List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Equipment
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Price
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Stats Boost
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredEquipments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    <Shield className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                    <p className="text-lg font-medium">No equipment found</p>
                    <p className="mt-1">Create your first equipment item to get started</p>
                  </td>
                </tr>
              ) : (
                filteredEquipments.map((equipment) => (
                  <tr key={equipment.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        {equipment.image_url ? (
                          <div className="flex-shrink-0 h-10 w-10">
                            <img
                              className="h-10 w-10 rounded object-cover"
                              src={equipment.image_url}
                              alt={equipment.name}
                            />
                          </div>
                        ) : (
                          <div className="flex-shrink-0 h-10 w-10 bg-gray-100 rounded flex items-center justify-center">
                            <ImageIcon className="w-5 h-5 text-gray-400" />
                          </div>
                        )}
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {equipment.name}
                          </div>
                          <div className="text-sm text-gray-500">
                            {equipment.description}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          {getTypeIcon(equipment.type)}
                        </div>
                        <div className="ml-2">
                          <div className="text-sm font-medium text-gray-900">
                            {getTypeName(equipment.type)}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatPrice(equipment)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {Object.entries({
                          endurance: equipment.endurance_boost,
                          strength: equipment.strength_boost,
                          agility: equipment.agility_boost,
                          speed: equipment.speed_boost,
                          smash: equipment.smash_boost,
                          defense: equipment.defense_boost,
                          serve: equipment.serve_boost
                        }).map(([stat, value]) => (
                          value !== 0 && (
                            <span 
                              key={stat} 
                              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getStatColor(value)} bg-gray-100`}
                            >
                              {stat}: {value > 0 ? `+${value}` : value}
                            </span>
                          )
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        equipment.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {equipment.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => handleEditEquipment(equipment)}
                          className="text-blue-600 hover:text-blue-900 p-1"
                          title="Edit Equipment"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteEquipment(equipment.id)}
                          className="text-red-600 hover:text-red-900 p-1"
                          title="Delete Equipment"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create/Edit Equipment Form Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleSubmit}>
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">
                  {editingEquipment ? 'Edit Equipment' : 'Create New Equipment'}
                </h2>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="px-6 py-6 space-y-6">
                {/* Image Upload */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Equipment Image
                  </label>
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0 h-24 w-24 rounded-md overflow-hidden bg-gray-100">
                      {imagePreview ? (
                        <img
                          src={imagePreview}
                          alt="Equipment preview"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-gray-400">
                          <ImageIcon className="w-8 h-8" />
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none">
                        <span>Upload an image</span>
                        <input
                          type="file"
                          className="sr-only"
                          onChange={handleImageUpload}
                          accept="image/*"
                        />
                      </label>
                      <p className="text-xs text-gray-500 mt-1">
                        PNG, JPG up to 5MB
                      </p>
                      {imageUploading && (
                        <p className="text-xs text-blue-500">Uploading...</p>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Name
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter equipment name"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter equipment description"
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Type
                    </label>
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as Equipment['type'] }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="racket">Racket</option>
                      <option value="shoes">Shoes</option>
                      <option value="strings">Strings</option>
                      <option value="shirt">Shirt</option>
                      <option value="shorts">Shorts</option>
                    </select>
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="isActive"
                      checked={formData.is_active}
                      onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor="isActive" className="ml-2 text-sm text-gray-700">
                      Active
                    </label>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Pricing</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Coins
                      </label>
                      <input
                        type="number"
                        value={formData.price_coins}
                        onChange={(e) => setFormData(prev => ({ ...prev, price_coins: parseInt(e.target.value) }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Diamonds
                      </label>
                      <input
                        type="number"
                        value={formData.price_diamonds}
                        onChange={(e) => setFormData(prev => ({ ...prev, price_diamonds: parseInt(e.target.value) }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Shuttlecocks
                      </label>
                      <input
                        type="number"
                        value={formData.price_shuttlecocks}
                        onChange={(e) => setFormData(prev => ({ ...prev, price_shuttlecocks: parseInt(e.target.value) }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        min="0"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Stat Boosts</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {([
                      'endurance_boost',
                      'strength_boost',
                      'agility_boost',
                      'speed_boost',
                      'explosiveness_boost',
                      'injury_prevention_boost',
                      'smash_boost',
                      'defense_boost',
                      'serve_boost',
                      'stick_boost',
                      'slice_boost',
                      'drop_boost'
                    ] as const).map((stat) => (
                      <div key={stat}>
                        <label className="block text-sm font-medium text-gray-700 mb-2 capitalize">
                          {stat.replace('_boost', '')}
                        </label>
                        <input
                          type="number"
                          value={formData[stat]}
                          onChange={(e) => setFormData(prev => ({ ...prev, [stat]: parseInt(e.target.value) }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium"
                  disabled={loading || imageUploading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={loading || imageUploading}
                >
                  {loading ? 'Saving...' : (editingEquipment ? 'Update Equipment' : 'Create Equipment')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminEquipmentManagement;