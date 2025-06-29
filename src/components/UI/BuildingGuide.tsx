import React, { useState } from 'react';
import { 
  Building,
  BookOpen, 
  Crown, 
  Hammer,
  ChevronDown,
  ChevronRight,
  Star,
  Clock,
  TrendingUp
} from 'lucide-react';
import {ResourceAmount, resourceData} from "../../data/gameData";
import { buildingCategories, buildingDatabase, BuildingData } from "../../data/buildingsData";

export const BuildingGuide: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedBuilding, setSelectedBuilding] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['overview']));

  const categories = ['All', ...Object.keys(buildingCategories)];
  
  const filteredBuildings = selectedCategory === 'All' 
    ? buildingDatabase 
    : buildingDatabase.filter(b => b.category === selectedCategory);

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const renderResourceCost = (resources: ResourceAmount) => {
    return (
      <div className="flex flex-wrap gap-2">
        {Object.entries(resources).map(([resource, amount]) => {
          const resourceDetails = resourceData[resource as keyof typeof resourceData];
          if (!resourceDetails) return null;
          const Icon = resourceDetails.icon;
          
          return (
            <div key={resource} className="flex items-center space-x-1 bg-slate-700 px-2 py-1 rounded">
              <Icon className="w-3 h-3" style={{ color: resourceDetails.color }} />
              <span className="text-white text-xs font-semibold">{amount}</span>
            </div>
          );
        })}
      </div>
    );
  };

  const renderBuildingCard = (building: BuildingData) => {
    const CategoryIcon = buildingCategories[building.category].icon;
    const isSelected = selectedBuilding === building.id;
    
    return (
      <div
        key={building.id}
        className={`p-4 rounded-lg border cursor-pointer transition-all ${
          isSelected 
            ? 'bg-blue-900 border-blue-600 shadow-lg' 
            : 'bg-slate-800 border-slate-600 hover:bg-slate-700'
        }`}
        onClick={() => setSelectedBuilding(isSelected ? null : building.id)}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <CategoryIcon 
              className="w-5 h-5" 
              style={{ color: buildingCategories[building.category].color }}
            />
            <h3 className="text-white font-semibold">{building.name}</h3>
          </div>
          <div className="flex items-center space-x-2">
            <span className={`text-xs px-2 py-1 rounded font-semibold`}
                  style={{ 
                    backgroundColor: buildingCategories[building.category].color + '20',
                    color: buildingCategories[building.category].color
                  }}>
              {building.category}
            </span>
            <Star className="w-4 h-4 text-yellow-400" />
            <span className="text-yellow-400 text-sm font-semibold">{building.maxLevel}</span>
          </div>
        </div>
        
        <p className="text-slate-300 text-sm mb-3">{building.description}</p>
        
        <div className="text-xs text-slate-400 mb-2">
          <strong>Strategic Importance:</strong> {building.strategicImportance}
        </div>
        
        {building.factionVariations && (
          <div className="text-xs text-slate-400 mb-3">
            <strong>Faction Variations:</strong>
            <ul className="mt-1 space-y-1">
              {Object.entries(building.factionVariations).map(([faction, variation]) => (
                <li key={faction} className="ml-2">
                  • <span className="capitalize font-semibold">{faction}:</span> {variation}
                </li>
              ))}
            </ul>
          </div>
        )}
        
        {isSelected && (
          <div className="mt-4 space-y-4">
            <div className="border-t border-slate-600 pt-4">
              <h4 className="text-white font-semibold mb-3 flex items-center">
                <TrendingUp className="w-4 h-4 mr-2 text-green-400" />
                Level Progression
              </h4>
              
              <div className="space-y-3">
                {building.levels.map((level,) => (
                  <div key={level.level} className="bg-slate-900 p-3 rounded border border-slate-700">
                    <div className="flex items-center justify-between mb-2">
                      <h5 className="text-white font-semibold">Level {level.level}</h5>
                      <div className="flex items-center space-x-3">
                        <div className="flex items-center space-x-1">
                          <Hammer className="w-3 h-3 text-blue-400" />
                          <span className="text-blue-400 text-xs font-semibold">{level.apCost} AP</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Clock className="w-3 h-3 text-yellow-400" />
                          <span className="text-yellow-400 text-xs font-semibold">{level.buildTime}m</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <div className="text-xs text-slate-400 mb-1">Cost:</div>
                        {renderResourceCost(level.resourcesCost)}
                      </div>
                      
                      {level.constraints && level.constraints.requiredBuildings && (
                        <div>
                          <div className="text-xs text-slate-400 mb-1">Prerequisites:</div>
                          <div className="text-xs text-orange-400">
                            {Object.entries(level.constraints.requiredBuildings).map(b => b[0]).join(', ')}
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div className="mt-2">
                      <div className="text-xs text-slate-400 mb-1">Benefits:</div>
                      <ul className="text-xs text-green-400 space-y-1">
                        {level.benefits.map((benefit, i) => (
                          <li key={i}>• {benefit}</li>
                        ))}
                      </ul>
                    </div>
                    
                    {level.effects && level.effects.resourceProduction && (
                      <div className="mt-2">
                        <div className="text-xs text-slate-400 mb-1">Production per turn:</div>
                        {renderResourceCost(level.effects.resourceProduction)}
                      </div>
                    )}
                    
                    {level.effects && level.effects.resourceStorage && (
                      <div className="mt-2">
                        <div className="text-xs text-slate-400 mb-1">Capacity:</div>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(level.effects.resourceStorage).map(([type, amount]) => (
                            <div key={type} className="text-xs text-cyan-400">
                              {type}: {amount}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto p-6 bg-slate-900 text-white">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-4 flex items-center">
          <Building className="w-8 h-8 mr-3 text-amber-400" />
          Building System Guide
        </h1>
        <p className="text-slate-300 text-lg">
          Master the art of construction and city development in Heroes Kingdoms
        </p>
      </div>

      {/* Overview Section */}
      <div className="mb-8">
        <button
          onClick={() => toggleSection('overview')}
          className="flex items-center space-x-2 text-xl font-semibold mb-4 hover:text-blue-400 transition-colors"
        >
          {expandedSections.has('overview') ? 
            <ChevronDown className="w-5 h-5" /> : 
            <ChevronRight className="w-5 h-5" />
          }
          <BookOpen className="w-6 h-6 text-blue-400" />
          <span>System Overview</span>
        </button>
        
        {expandedSections.has('overview') && (
          <div className="bg-slate-800 p-6 rounded-lg border border-slate-600 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <Hammer className="w-12 h-12 text-blue-400 mx-auto mb-3" />
                <h3 className="text-lg font-semibold mb-2">Action Points (AP)</h3>
                <p className="text-slate-300 text-sm">
                  Buildings cost 1-10 AP based on complexity. Plan your construction carefully as AP is limited per turn.
                </p>
              </div>
              
              <div className="text-center">
                <TrendingUp className="w-12 h-12 text-green-400 mx-auto mb-3" />
                <h3 className="text-lg font-semibold mb-2">Progressive Upgrades</h3>
                <p className="text-slate-300 text-sm">
                  Buildings can be upgraded 1-5 levels. Each level increases costs but provides significant benefits.
                </p>
              </div>
              
              <div className="text-center">
                <Crown className="w-12 h-12 text-purple-400 mx-auto mb-3" />
                <h3 className="text-lg font-semibold mb-2">Strategic Depth</h3>
                <p className="text-slate-300 text-sm">
                  Prerequisites and tech trees create meaningful choices. Plan your building order for maximum efficiency.
                </p>
              </div>
            </div>
            
            <div className="mt-6 p-4 bg-blue-900 bg-opacity-30 rounded border border-blue-600">
              <h4 className="text-blue-300 font-semibold mb-2">Quick Reference:</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-slate-400">AP Range:</span>
                  <span className="text-white ml-2">1-10 per building</span>
                </div>
                <div>
                  <span className="text-slate-400">Max Levels:</span>
                  <span className="text-white ml-2">3-5 depending on type</span>
                </div>
                <div>
                  <span className="text-slate-400">Build Time:</span>
                  <span className="text-white ml-2">30-240 minutes</span>
                </div>
                <div>
                  <span className="text-slate-400">Categories:</span>
                  <span className="text-white ml-2">Military, Resource, Support</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Category Filter */}
      <div className="mb-6">
        <div className="flex flex-wrap gap-2">
          {categories.map(category => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                selectedCategory === category
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      {/* Buildings Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredBuildings.map(renderBuildingCard)}
      </div>

      {/* Construction Tips */}
      <div className="mt-12 bg-gradient-to-r from-amber-900 to-orange-900 p-6 rounded-lg border border-amber-600">
        <h3 className="text-xl font-semibold mb-4 flex items-center">
          <Star className="w-6 h-6 mr-2 text-amber-400" />
          Master Builder Tips
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <h4 className="font-semibold text-amber-300 mb-2">Early Game Priority:</h4>
            <ul className="space-y-1 text-amber-100">
              <li>• Town Hall L1 → Barracks L1 → Mine L1</li>
              <li>• Focus on resource generation first</li>
              <li>• Upgrade Town Hall to unlock advanced buildings</li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-semibold text-amber-300 mb-2">Mid Game Strategy:</h4>
            <ul className="space-y-1 text-amber-100">
              <li>• Marketplace for resource flexibility</li>
              <li>• Mage Guild for magical advantages</li>
              <li>• Blacksmith for unit upgrades</li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-semibold text-amber-300 mb-2">Late Game Focus:</h4>
            <ul className="space-y-1 text-amber-100">
              <li>• Max level Town Hall for population</li>
              <li>• Advanced military buildings</li>
              <li>• Specialized faction buildings</li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-semibold text-amber-300 mb-2">Resource Management:</h4>
            <ul className="space-y-1 text-amber-100">
              <li>• Balance production and consumption</li>
              <li>• Upgrade storage before major expansions</li>
              <li>• Trade excess resources at Marketplace</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};