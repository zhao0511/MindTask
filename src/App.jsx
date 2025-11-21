import React, { useState, useEffect, useRef, useLayoutEffect, useCallback } from 'react';
import { 
  Plus, Trash2, ChevronRight, Layout, Maximize, Minimize, Folder, MousePointer2, 
  Calendar as CalendarIcon, Clock, Zap, AlignLeft, CheckSquare, Square, X, ArrowUp, ArrowDown, 
  Edit2, GripVertical, Columns, Sun, Sunset, Moon, ChevronLeft, 
  ChevronRight as ChevronRightIcon, List, Filter, Grid, Check, Undo, Type
} from 'lucide-react';

// --- 基础工具 ---
const generateId = () => Math.random().toString(36).substr(2, 9);
const getTodayStr = () => new Date().toISOString().slice(0, 10);
const addDays = (dateStr, days) => {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};
const formatTime = (isoString) => {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (isoString.length === 10 || isoString.includes('T23:59')) {
      return date.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric' });
  }
  return date.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

// 暗色模式下的 DDL 颜色逻辑
const getDDLStatusColor = (ddl) => {
  if (!ddl) return 'bg-gray-700 text-gray-300 border-gray-600';
  const now = new Date();
  const targetStr = ddl.length === 10 ? `${ddl}T23:59:59` : ddl;
  const target = new Date(targetStr);
  const diff = target - now;
  if (diff < 0) return 'bg-red-900/30 text-red-300 border-red-800/50';
  if (diff < 24 * 60 * 60 * 1000) return 'bg-orange-900/30 text-orange-300 border-orange-800/50';
  if (diff < 3 * 24 * 60 * 60 * 1000) return 'bg-yellow-900/30 text-yellow-300 border-yellow-800/50';
  return 'bg-green-900/30 text-green-300 border-green-800/50';
};

const INITIAL_PAGE_ID = 'page-1';
const INITIAL_ROOT_ID = 'root-1';
const PLANNER_HIDDEN_ROOT_ID = 'planner-hidden-root';

const INITIAL_DATA = {
  pages: [
    { id: INITIAL_PAGE_ID, title: '我的第一个项目', rootId: INITIAL_ROOT_ID }
  ],
  nodes: {
    [INITIAL_ROOT_ID]: {
      id: INITIAL_ROOT_ID,
      text: '项目核心目标',
      children: ['node-1', 'node-2'],
      parentId: null,
      isRoot: true,
      collapsed: false,
      completed: false,
      energy: 0,
      timeType: null,
      ddl: '',
      scheduleStart: '',
      scheduleEnd: '',
      notes: '',
      plannedSlots: [],
      isHeading: false
    },
    'node-1': {
      id: 'node-1',
      text: '阶段一：需求分析',
      children: ['node-1-1'],
      parentId: INITIAL_ROOT_ID,
      collapsed: false,
      completed: false,
      energy: 5,
      timeType: 'ddl',
      ddl: getTodayStr(), 
      scheduleStart: '',
      scheduleEnd: '',
      notes: '重点关注竞品分析',
      plannedSlots: [],
      isHeading: true 
    },
    'node-1-1': {
      id: 'node-1-1',
      text: '调研市场竞品',
      children: [],
      parentId: 'node-1',
      collapsed: false,
      completed: true,
      energy: 2,
      timeType: null,
      ddl: '',
      scheduleStart: '',
      scheduleEnd: '',
      notes: '',
      plannedSlots: [],
      isHeading: false
    },
    'node-2': {
      id: 'node-2',
      text: '阶段二：原型设计',
      children: [],
      parentId: INITIAL_ROOT_ID,
      collapsed: false,
      completed: false,
      energy: 3,
      timeType: 'schedule',
      ddl: '',
      scheduleStart: `${getTodayStr()}T14:00`,
      scheduleEnd: `${getTodayStr()}T16:00`,
      showSpecificTime: true,
      notes: '使用 Figma 进行设计',
      plannedSlots: [],
      isHeading: true
    }
  }
};

// --- 组件：自适应文本框 (Grid 方案) ---
const AutoResizeTextarea = ({ value, onChange, onKeyDown, onFocus, className, placeholder, isRoot, autoFocus }) => {
  const textareaRef = useRef(null);

  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      setTimeout(() => {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(textareaRef.current.value.length, textareaRef.current.value.length);
      }, 10);
    }
  }, [autoFocus]);

  const commonClass = className.replace('w-full', '').replace('absolute', '');

  return (
    <div className="grid grid-cols-1 grid-rows-1 items-center justify-items-start min-w-[20px] w-full">
      <div className={`${commonClass} invisible col-start-1 row-start-1 whitespace-pre-wrap overflow-hidden`} style={{ minHeight: isRoot ? '28px' : '24px' }}>
        {value || placeholder || " "}
      </div>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        onFocus={onFocus}
        rows={1}
        placeholder={placeholder}
        className={`${commonClass} col-start-1 row-start-1 w-full h-full resize-none overflow-hidden bg-transparent outline-none text-gray-200 placeholder-gray-600`}
        style={{ minHeight: isRoot ? '28px' : '24px' }}
      />
    </div>
  );
};

const NodeBadge = ({ icon: Icon, className, text }) => (
  <div className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full border ${className} mr-1 mb-1 whitespace-nowrap`}>
    <Icon size={10} />
    {text && <span>{text}</span>}
  </div>
);

// --- 组件：思维导图节点 (Dark Mode) ---
const MindMapNode = ({ 
  nodeId, nodes, updateNodeText, toggleComplete, onKeyDown, onFocus, toggleCollapse, addChildNode, 
  isFirstChild, isLastChild, isOnlyChild, focusedNodeId, onDragStart, onDrop, energyFilter, showCompleted,
  depth = 0 
}) => {
  const node = nodes[nodeId];
  
  if (!node || (!showCompleted && node.completed && !node.isRoot)) return null;

  const hasChildren = node.children && node.children.length > 0;
  const isFocused = focusedNodeId === nodeId;
  const showHandle = !node.isRoot;
  const isDimmed = energyFilter > 0 && node.energy !== energyFilter && !node.isRoot;
  const isHeading = !node.isRoot && node.isHeading && depth <= 2;

  const handleDragStart = (e) => {
    e.stopPropagation();
    e.dataTransfer.setData('text/plain', nodeId);
    e.dataTransfer.setData('application/mindmap-node', nodeId);
    e.dataTransfer.effectAllowed = 'move';
    onDragStart && onDragStart(nodeId);
  };
  const handleDragOver = (e) => { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'move'; };
  const handleDrop = (e) => {
    e.preventDefault(); e.stopPropagation();
    const draggedId = e.dataTransfer.getData('text/plain');
    if (draggedId && draggedId !== nodeId) { onDrop && onDrop(draggedId, nodeId); }
  };
  const renderScheduleTime = () => {
      if (!node.scheduleStart) return '未设置';
      const start = new Date(node.scheduleStart);
      const end = node.scheduleEnd ? new Date(node.scheduleEnd) : null;
      const isSameDay = end && start.toDateString() === end.toDateString();
      const endStr = end ? (isSameDay ? `${end.getHours()}:${String(end.getMinutes()).padStart(2,'0')}` : formatTime(node.scheduleEnd)) : '';
      return end ? `${formatTime(node.scheduleStart)} - ${endStr}` : formatTime(node.scheduleStart);
  };

  // 样式逻辑 (Dark Mode 适配)
  // 基础卡片：深灰背景，浅灰边框
  // 样式逻辑 (Dark Mode 适配 - 增强边框)
  // 基础卡片：深灰背景，浅灰边框
  // 修改点：border-gray-700 改为 border-gray-500，并移除部分 hover 的透明度，让边框更实
  let containerClass = `relative flex flex-col bg-gray-800 border rounded-lg shadow-sm transition-all duration-200 ${isFocused ? 'ring-2 ring-blue-500/80 border-blue-500' : 'border-gray-500 p-2 hover:border-blue-400'}`;
  let textClass = `w-full bg-transparent outline-none text-gray-200 leading-normal text-sm`;

  if (node.isRoot) {
      // 根节点：边框更亮更粗
      containerClass = `relative flex flex-col bg-gray-800 border-blue-500 border-2 p-3 shadow-md shadow-blue-900/20 rounded-lg ${isFocused ? 'ring-2 ring-blue-500/50' : ''}`;
      textClass = `w-full bg-transparent outline-none text-gray-100 leading-normal font-bold text-xl`;
  } else if (isHeading) {
      // 标题模式：增强边框可见度 (border-gray-500)
      containerClass = `relative flex flex-col bg-gray-800 border rounded-lg shadow-sm transition-all duration-200 p-2 border-gray-500 hover:border-blue-400 ${isFocused ? 'ring-2 ring-blue-500/50 border-blue-500' : ''}`;
      if (depth === 1) {
          textClass = `w-full bg-transparent outline-none text-gray-100 leading-tight font-bold text-xl`; 
      } else {
          textClass = `w-full bg-transparent outline-none text-gray-200 leading-tight font-bold text-lg`;
      }
  } else {
      // 普通任务：增强边框可见度 (border-gray-500)
      containerClass = `relative flex flex-col bg-gray-800 border rounded-lg shadow-sm transition-all duration-200 border-gray-500 p-2 hover:border-blue-400 ${isFocused ? 'ring-2 ring-blue-500/50 border-blue-500' : ''} ${node.completed ? 'opacity-50 bg-gray-800/50' : ''}`;
      textClass = `w-full bg-transparent outline-none text-gray-200 leading-normal text-sm ${node.completed ? 'line-through text-gray-500' : ''}`;
  }

  let nodeWidthStyle = {};
  if (node.isRoot) {
      nodeWidthStyle = { minWidth: '200px', width: 'fit-content', maxWidth: '400px' };
  } else if (isHeading) {
      nodeWidthStyle = { minWidth: '200px', width: 'fit-content', maxWidth: '400px' };
  } else {
      nodeWidthStyle = { minWidth: '260px', width: 'fit-content', maxWidth: '360px' };
  }

  return (
    <div className={`flex items-center group transition-opacity duration-300 ${isDimmed ? 'opacity-20 grayscale' : 'opacity-100'}`}>
      {!node.isRoot && (
        <div className="w-8 self-stretch relative flex items-center justify-center flex-shrink-0 pointer-events-none">
          {!isOnlyChild && (
            <>
              {(!isFirstChild || isLastChild) && <div className="absolute top-0 left-0 w-0.5 h-[50%] bg-gray-600" />}
              {(!isLastChild || isFirstChild) && <div className="absolute bottom-0 left-0 w-0.5 h-[50%] bg-gray-600" />}
            </>
          )}
          <div className="absolute left-0 top-1/2 w-full h-0.5 bg-gray-600" />
        </div>
      )}

      <div className="flex flex-col items-start justify-center mr-12 relative z-10 py-1">
        <div 
          onDragOver={handleDragOver} onDrop={handleDrop} onClick={(e) => { e.stopPropagation(); onFocus && onFocus(nodeId); }}
          className={containerClass}
          style={nodeWidthStyle}
        >
          <div className="flex items-start min-w-0">
            {showHandle && (
              <div draggable onDragStart={handleDragStart} className={`mr-1 mt-1 cursor-grab active:cursor-grabbing flex-shrink-0 ${isHeading ? 'text-gray-600 hover:text-gray-400' : 'text-gray-600 hover:text-gray-400'}`} onMouseDown={(e) => e.stopPropagation()}>
                <GripVertical size={14} />
              </div>
            )}
            {!node.isRoot && !isHeading && (
              <button onClick={(e) => { e.stopPropagation(); toggleComplete(nodeId); }} className="mr-2 mt-0.5 text-gray-500 hover:text-blue-400 transition-colors flex-shrink-0">
                {node.completed ? <CheckSquare size={18} className="text-gray-500" /> : <Square size={18} />}
              </button>
            )}
            
            <AutoResizeTextarea
              value={node.text} 
              onChange={(e) => updateNodeText(nodeId, e.target.value)} 
              onKeyDown={(e) => onKeyDown(e, nodeId)}
              onFocus={() => onFocus && onFocus(nodeId)} 
              isRoot={node.isRoot} 
              autoFocus={node.isNew}
              className={textClass}
              placeholder={node.isRoot ? "项目名称" : (isHeading ? "输入标题..." : "输入任务...")}
            />
          </div>
          
          {(!node.isRoot && !isHeading && (node.timeType || node.energy > 0)) && (
            <div className="flex flex-wrap items-center mt-2 pl-6">
              {node.timeType === 'ddl' && node.ddl && <NodeBadge icon={CalendarIcon} className={getDDLStatusColor(node.ddl)} text={formatTime(node.ddl)} />}
              {node.timeType === 'schedule' && node.scheduleStart && node.showSpecificTime && <NodeBadge icon={Clock} className="bg-blue-900/30 text-blue-300 border-blue-800/50" text={renderScheduleTime()} />}
              {node.energy > 0 && <div className="flex gap-0.5 mr-2 mb-1 bg-yellow-900/20 px-1.5 py-0.5 rounded-full border border-yellow-800/50 h-5 items-center">{[...Array(node.energy)].map((_, i) => <Zap key={i} size={8} className="text-yellow-500 fill-current" />)}</div>}
            </div>
          )}
          {node.notes && !node.isRoot && !isHeading && <div className="mt-1 pl-6 text-[10px] text-gray-500 whitespace-pre-wrap border-t border-gray-700 pt-1">{node.notes}</div>}
          
          {hasChildren && (
            <button onClick={(e) => { e.stopPropagation(); toggleCollapse(nodeId); }} className={`absolute -right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 bg-gray-800 border border-gray-600 rounded-full flex items-center justify-center hover:bg-gray-700 z-20 shadow-sm cursor-pointer ${isHeading ? 'top-1/2' : ''}`}>
              {node.collapsed ? <Plus size={10} className="text-gray-400" /> : <ChevronRight size={10} className="text-gray-400" />}
            </button>
          )}
          {hasChildren && !node.collapsed && <div className={`absolute right-0 w-12 h-0.5 bg-gray-600 translate-x-full pointer-events-none top-1/2`} />}
        </div>
      </div>
      {hasChildren && !node.collapsed && (
        <div className="flex flex-col justify-center relative"> 
          {node.children.map((childId, index) => (
            <MindMapNode 
              key={childId} nodeId={childId} nodes={nodes} updateNodeText={updateNodeText} toggleComplete={toggleComplete}
              onKeyDown={onKeyDown} onFocus={onFocus} toggleCollapse={toggleCollapse} addChildNode={addChildNode}
              focusedNodeId={focusedNodeId} onDragStart={onDragStart} onDrop={onDrop} energyFilter={energyFilter} showCompleted={showCompleted}
              isFirstChild={index === 0} isLastChild={index === node.children.length - 1} isOnlyChild={node.children.length === 1}
              depth={depth + 1} 
            />
          ))}
        </div>
      )}
    </div>
  );
};

// --- 组件：日程规划板 ---
const PlannerBoard = ({ nodes, updateNodeData, createPlannerTask, updateNodeText, jumpToTask, deleteNode }) => {
  const [currentDate, setCurrentDate] = useState(getTodayStr());
  const changeDay = (offset) => setCurrentDate(prev => addDays(prev, offset));

  const getTasksForPeriod = (period) => {
    return Object.values(nodes).filter(node => {
      if (node.timeType === 'schedule' && node.scheduleStart) {
        const start = new Date(node.scheduleStart);
        const dateStr = start.toISOString().slice(0, 10);
        const hour = start.getHours();
        if (dateStr !== currentDate) return false;
        if (period === 'morning') return hour < 12;
        if (period === 'afternoon') return hour >= 12 && hour < 18;
        if (period === 'evening') return hour >= 18;
      }
      if (node.plannedSlots && node.plannedSlots.some(slot => slot.date === currentDate && slot.period === period)) {
        return true;
      }
      return false;
    });
  };

  const handleDrop = (e, period) => {
    e.preventDefault();
    const nodeId = e.dataTransfer.getData('text/plain');
    if (!nodeId || !nodes[nodeId]) return;
    const node = nodes[nodeId];

    if (node.timeType === 'schedule') {
      let defaultHour = 9;
      if (period === 'afternoon') defaultHour = 14;
      if (period === 'evening') defaultHour = 19;
      const newStart = `${currentDate}T${String(defaultHour).padStart(2, '0')}:00`;
      updateNodeData(nodeId, { scheduleStart: newStart });
    } else {
      const newSlot = { date: currentDate, period };
      const exists = node.plannedSlots?.some(s => s.date === currentDate && s.period === period);
      if (!exists) {
        updateNodeData(nodeId, { 
          plannedSlots: [...(node.plannedSlots || []), newSlot] 
        });
      }
    }
  };

  const removeTaskFromPlanner = (nodeId, period) => {
    const node = nodes[nodeId];
    if(node.parentId === PLANNER_HIDDEN_ROOT_ID) {
        if(window.confirm("确定永久删除这个独立任务吗？")) deleteNode(nodeId);
        return;
    }
    if (node.timeType === 'schedule') {
       if(window.confirm("要清除此任务的日程时间吗？")) updateNodeData(nodeId, { scheduleStart: '', timeType: null });
    } else {
       const newSlots = node.plannedSlots.filter(s => !(s.date === currentDate && s.period === period));
       updateNodeData(nodeId, { plannedSlots: newSlots });
    }
  };

  const handleCreateTask = (period) => {
      let defaultHour = 9;
      if (period === 'afternoon') defaultHour = 14;
      if (period === 'evening') defaultHour = 19;
      const start = `${currentDate}T${String(defaultHour).padStart(2, '0')}:00`;
      createPlannerTask({ scheduleStart: start, timeType: 'schedule', showSpecificTime: false });
  };

  const renderZone = (title, icon, period, bgColor, borderColor) => (
    <div className="flex-1 flex flex-col border-r border-gray-700 last:border-r-0 min-w-[200px]" onDragOver={(e) => e.preventDefault()} onDrop={(e) => handleDrop(e, period)}>
      <div className={`p-2 font-semibold text-sm flex items-center justify-between ${bgColor} text-gray-200 border-b ${borderColor}`}>
        <div className="flex items-center gap-2">{icon}{title}</div>
        <button onClick={() => handleCreateTask(period)} className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-blue-400 transition-colors"><Plus size={14} /></button>
      </div>
      <div className="flex-1 p-2 bg-gray-900/50 space-y-2 overflow-y-auto">
        {getTasksForPeriod(period).map(node => (
          <div key={node.id} onClick={() => jumpToTask(node.id)} className="bg-gray-800 p-2 rounded border border-gray-700 shadow-sm text-sm group hover:border-blue-500/50 transition-all relative pr-6 cursor-pointer">
             <button onClick={(e) => { e.stopPropagation(); removeTaskFromPlanner(node.id, period); }} className="absolute right-1 top-1 opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400"><X size={12}/></button>
             <div className="flex flex-col gap-1">
               <input className="font-medium text-gray-200 w-full bg-transparent outline-none border-b border-transparent focus:border-blue-500/50 placeholder-gray-600" value={node.text} onClick={(e) => e.stopPropagation()} onChange={(e) => updateNodeText(node.id, e.target.value)} placeholder="输入任务..." />
               <div className="flex flex-wrap gap-1 items-center">
                 {node.timeType === 'ddl' && node.ddl && <NodeBadge icon={CalendarIcon} className={getDDLStatusColor(node.ddl)} text={formatTime(node.ddl)} />}
                 {node.showSpecificTime && node.scheduleStart && <NodeBadge icon={Clock} className="bg-blue-900/30 text-blue-300 border-blue-800/50" text={new Date(node.scheduleStart).getHours() + ':' + String(new Date(node.scheduleStart).getMinutes()).padStart(2,'0')} />}
                 {node.energy > 0 && <div className="flex gap-0.5 bg-yellow-900/20 px-1 py-0.5 rounded border border-yellow-800/50 items-center">{[...Array(node.energy)].map((_, i) => <Zap key={i} size={8} className="text-yellow-500 fill-current" />)}</div>}
               </div>
             </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col bg-gray-800 border-l border-gray-700 shadow-xl z-30 w-[450px] flex-shrink-0">
      <div className="p-4 border-b border-gray-700 flex items-center justify-between bg-gray-900">
        <h2 className="font-bold text-gray-200 flex items-center gap-2"><CalendarIcon size={18} className="text-blue-500" />日程板</h2>
        <div className="flex items-center bg-gray-800 rounded border border-gray-600">
            <button onClick={() => changeDay(-1)} className="p-1.5 hover:bg-gray-700 text-gray-400 border-r border-gray-600"><ChevronLeft size={14} /></button>
            <input type="date" value={currentDate} onChange={(e) => setCurrentDate(e.target.value)} className="text-sm px-2 py-1 bg-gray-800 text-gray-200 outline-none focus:bg-gray-700 w-32 text-center font-mono" />
            <button onClick={() => changeDay(1)} className="p-1.5 hover:bg-gray-700 text-gray-400 border-l border-gray-600"><ChevronRightIcon size={14} /></button>
        </div>
      </div>
      <div className="flex-1 flex flex-col overflow-hidden">
        {renderZone('上午', <Sun size={16} className="text-orange-400"/>, 'morning', 'bg-orange-900/20', 'border-orange-900/50')}
        {renderZone('下午', <Sunset size={16} className="text-blue-400"/>, 'afternoon', 'bg-blue-900/20', 'border-blue-900/50')}
        {renderZone('晚上', <Moon size={16} className="text-indigo-400"/>, 'evening', 'bg-indigo-900/20', 'border-indigo-900/50')}
      </div>
    </div>
  );
};

// --- 组件：排序与筛选视图 (含日历弹窗) ---
const SorterView = ({ nodes, updateNodeData, jumpToTask }) => {
  const [viewType, setViewType] = useState('list'); 
  const [energyFilter, setEnergyFilter] = useState(0); 
  const [calMonth, setCalMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(null); 

  const filterNodes = (n) => (energyFilter === 0 || n.energy === energyFilter) && !n.isRoot;
  const scheduleTasks = Object.values(nodes).filter(n => n.timeType === 'schedule' && n.scheduleStart && filterNodes(n)).sort((a, b) => new Date(a.scheduleStart) - new Date(b.scheduleStart));
  const ddlTasks = Object.values(nodes).filter(n => n.timeType === 'ddl' && n.ddl && filterNodes(n)).sort((a, b) => new Date(a.ddl) - new Date(b.ddl));

  const renderTaskItem = (n, type) => (
    <div key={n.id} onClick={() => jumpToTask(n.id)} className="flex items-center justify-between p-3 bg-gray-800 border border-gray-700 rounded mb-2 hover:border-blue-500/50 cursor-pointer">
       <div className="flex items-center gap-2">
           <div className={`w-1 h-8 rounded-full ${type === 'schedule' ? 'bg-blue-500' : 'bg-red-500'}`} />
           <div>
               <div className="font-medium text-gray-200">{n.text || '未命名'}</div>
               <div className="text-xs text-gray-500 flex gap-2 mt-1">
                   {type === 'schedule' ? formatTime(n.scheduleStart) : `截止: ${formatTime(n.ddl)}`}
                   {n.energy > 0 && <span className="text-yellow-500 flex items-center"><Zap size={10} className="fill-current mr-1"/>{n.energy}</span>}
               </div>
           </div>
       </div>
    </div>
  );

  const renderCalendar = () => {
    const year = calMonth.getFullYear();
    const month = calMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay() || 7; 
    const days = [];
    for(let i=1; i<startDayOfWeek; i++) days.push(null);
    for(let i=1; i<=daysInMonth; i++) days.push(new Date(year, month, i));

    return (
        <div className="h-full flex flex-col bg-gray-800 rounded-xl border border-gray-700 shadow-sm relative">
            {/* 日历头部 */}
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
                <button onClick={() => setCalMonth(new Date(year, month - 1))} className="p-1 hover:bg-gray-700 rounded text-gray-300"><ChevronLeft/></button>
                <span className="font-bold text-gray-200">{year}年 {month + 1}月</span>
                <button onClick={() => setCalMonth(new Date(year, month + 1))} className="p-1 hover:bg-gray-700 rounded text-gray-300"><ChevronRightIcon/></button>
            </div>
            <div className="grid grid-cols-7 text-center text-xs font-semibold text-gray-500 py-2 border-b border-gray-700 bg-gray-900">
                <div>一</div><div>二</div><div>三</div><div>四</div><div>五</div><div>六</div><div>日</div>
            </div>
            <div className="grid grid-cols-7 flex-1 auto-rows-fr overflow-y-auto">
                {days.map((d, idx) => {
                    if(!d) return <div key={idx} className="bg-gray-900/50 border-b border-r border-gray-700"/>;
                    const dayStr = d.toISOString().slice(0, 10);
                    const dayTasks = Object.values(nodes).filter(n => {
                        if(!filterNodes(n)) return false;
                        if(n.timeType === 'ddl' && n.ddl && n.ddl.startsWith(dayStr)) return true;
                        if(n.timeType === 'schedule' && n.scheduleStart && n.scheduleStart.startsWith(dayStr)) return true;
                        return false;
                    });

                    return (
                        <div key={idx} onClick={() => setSelectedDay(d)} className="border-b border-r border-gray-700 p-1 relative min-h-[80px] hover:bg-blue-900/20 transition-colors group cursor-pointer">
                            <div className={`text-xs font-medium mb-1 ${dayStr === getTodayStr() ? 'text-blue-400 font-bold' : 'text-gray-500'}`}>{d.getDate()}</div>
                            <div className="space-y-1 overflow-hidden">
                                {dayTasks.slice(0, 4).map(t => (
                                    <div key={t.id} className={`text-[10px] truncate px-1 rounded ${t.timeType === 'ddl' ? 'bg-red-900/50 text-red-300' : 'bg-blue-900/50 text-blue-300'}`}>{t.text || '未命名'}</div>
                                ))}
                                {dayTasks.length > 4 && <div className="text-[10px] text-gray-500 pl-1">+{dayTasks.length - 4} 更多</div>}
                            </div>
                        </div>
                    );
                })}
            </div>
            {selectedDay && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center" onClick={() => setSelectedDay(null)}>
                    <div className="bg-gray-800 border border-gray-700 w-80 max-h-[80%] rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        <div className="p-3 border-b border-gray-700 flex items-center justify-between bg-gray-900">
                            <button onClick={() => setSelectedDay(prev => { const d = new Date(prev); d.setDate(d.getDate()-1); return d; })} className="p-1 hover:bg-gray-700 rounded text-gray-300"><ChevronLeft size={16}/></button>
                            <span className="font-bold text-gray-200">{selectedDay.getMonth()+1}月{selectedDay.getDate()}日 任务</span>
                            <button onClick={() => setSelectedDay(prev => { const d = new Date(prev); d.setDate(d.getDate()+1); return d; })} className="p-1 hover:bg-gray-700 rounded text-gray-300"><ChevronRightIcon size={16}/></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-2">
                             {Object.values(nodes).filter(n => {
                                const dayStr = selectedDay.toISOString().slice(0, 10);
                                if(n.timeType === 'ddl' && n.ddl && n.ddl.startsWith(dayStr)) return true;
                                if(n.timeType === 'schedule' && n.scheduleStart && n.scheduleStart.startsWith(dayStr)) return true;
                                return false;
                             }).length === 0 && <div className="text-center text-gray-500 py-4">今日无任务</div>}
                             {Object.values(nodes).filter(n => {
                                const dayStr = selectedDay.toISOString().slice(0, 10);
                                if(n.timeType === 'ddl' && n.ddl && n.ddl.startsWith(dayStr)) return true;
                                if(n.timeType === 'schedule' && n.scheduleStart && n.scheduleStart.startsWith(dayStr)) return true;
                                return false;
                             }).map(t => renderTaskItem(t, t.timeType))}
                        </div>
                        <button onClick={() => setSelectedDay(null)} className="p-3 text-sm text-gray-400 hover:bg-gray-700 border-t border-gray-700">关闭</button>
                    </div>
                </div>
            )}
        </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-gray-900 z-30 flex-1 overflow-hidden">
        <div className="p-4 bg-gray-800 border-b border-gray-700 flex items-center justify-between shadow-sm">
             <div className="flex items-center gap-4">
                 <h2 className="font-bold text-lg text-gray-200">任务排序</h2>
                 <div className="flex bg-gray-700 p-1 rounded-lg">
                     <button onClick={() => setViewType('list')} className={`px-3 py-1 text-xs rounded-md transition-all ${viewType === 'list' ? 'bg-gray-600 shadow text-blue-300 font-medium' : 'text-gray-400'}`}><List size={14} className="inline mr-1"/>列表</button>
                     <button onClick={() => setViewType('calendar')} className={`px-3 py-1 text-xs rounded-md transition-all ${viewType === 'calendar' ? 'bg-gray-600 shadow text-blue-300 font-medium' : 'text-gray-400'}`}><CalendarIcon size={14} className="inline mr-1"/>日历</button>
                 </div>
             </div>
             <div className="flex items-center gap-2">
                 <span className="text-xs text-gray-400 font-medium uppercase"><Filter size={12} className="inline mr-1"/>精力筛选:</span>
                 <div className="flex gap-1">
                     <button onClick={() => setEnergyFilter(0)} className={`px-2 py-1 text-xs rounded border border-gray-600 ${energyFilter === 0 ? 'bg-gray-600 text-white' : 'bg-gray-800 text-gray-400'}`}>全部</button>
                     {[1,2,3,4,5].map(l => (
                         <button key={l} onClick={() => setEnergyFilter(l)} className={`w-6 h-6 flex items-center justify-center text-xs rounded border border-gray-600 ${energyFilter === l ? 'bg-yellow-900/50 border-yellow-500 text-yellow-300' : 'bg-gray-800 text-gray-400'}`}>
                             {l}
                         </button>
                     ))}
                 </div>
             </div>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
            {viewType === 'list' ? (
                <div className="flex gap-6 h-full">
                    <div className="flex-1 bg-blue-900/10 p-4 rounded-xl border border-blue-900/50 overflow-y-auto">
                        <h3 className="font-bold text-blue-300 mb-4 flex items-center gap-2"><Clock size={18}/> 日程安排 (Schedule)</h3>
                        {scheduleTasks.map(n => renderTaskItem(n, 'schedule'))}
                        {scheduleTasks.length === 0 && <div className="text-center text-gray-500 text-sm mt-10">无日程任务</div>}
                    </div>
                    <div className="flex-1 bg-red-900/10 p-4 rounded-xl border border-red-900/50 overflow-y-auto">
                        <h3 className="font-bold text-red-300 mb-4 flex items-center gap-2"><CalendarIcon size={18}/> 截止日期 (DDL)</h3>
                        {ddlTasks.map(n => renderTaskItem(n, 'ddl'))}
                        {ddlTasks.length === 0 && <div className="text-center text-gray-500 text-sm mt-10">无 DDL 任务</div>}
                    </div>
                </div>
            ) : (
                renderCalendar()
            )}
        </div>
    </div>
  );
};

// --- 属性详情面板 (增加标题模式切换) ---
const PropertiesPanel = ({ nodeId, node, updateNodeText, updateNodeData, onClose, moveNodeOrder, deleteNode, depth }) => {
  const [editDDLTime, setEditDDLTime] = useState(false);
  if (!node) return null;
  
  const handleTimeAdd = () => {
      const baseDate = node.ddl && node.ddl.length >= 10 ? node.ddl.slice(0, 10) : getTodayStr();
      updateNodeData(nodeId, { ddl: `${baseDate}T12:00` }); 
      setEditDDLTime(true);
  };
  const isFullDateTime = node.ddl && node.ddl.length > 10;

  // 计算是否允许设为标题 (depth <= 2 且不是根节点)
  const canBeHeading = !node.isRoot && depth <= 2;

  return (
    <div className="w-80 bg-gray-800 border-l border-gray-700 h-full flex flex-col shadow-xl z-40 absolute right-0 top-0" onClick={(e) => e.stopPropagation()}>
      <div className="p-4 border-b border-gray-700 flex items-center justify-between bg-gray-900">
        <span className="font-semibold text-gray-200 flex items-center gap-2"><AlignLeft size={16} />任务详情</span>
        <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={18} /></button>
      </div>
      <div className="p-6 flex-1 overflow-y-auto space-y-8">
        {/* 标题模式切换开关 */}
        {canBeHeading && (
            <div className="flex items-center justify-between bg-gray-900 p-3 rounded-lg border border-gray-700">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-300">
                    <Type size={16}/> 设为标题节点
                </div>
                <div 
                    onClick={() => updateNodeData(nodeId, { isHeading: !node.isHeading })}
                    className={`w-10 h-5 rounded-full flex items-center p-0.5 cursor-pointer transition-colors ${node.isHeading ? 'bg-blue-600' : 'bg-gray-600'}`}
                >
                    <div className={`w-4 h-4 bg-white rounded-full shadow transform transition-transform ${node.isHeading ? 'translate-x-5' : 'translate-x-0'}`} />
                </div>
            </div>
        )}

        <div className="space-y-1 border-b border-gray-700 pb-4">
             <label className="text-[10px] text-gray-500 font-semibold uppercase">任务内容</label>
             <textarea value={node.text} onChange={(e) => updateNodeText(nodeId, e.target.value)} rows={2} className="w-full text-lg font-medium text-gray-100 bg-transparent outline-none resize-none focus:bg-gray-700 rounded p-1 -ml-1" />
        </div>
        
        {/* 如果是标题，隐藏以下所有属性 */}
        {!node.isHeading && (
        <>
        <div className="flex items-center gap-2">
            <button onClick={() => moveNodeOrder(nodeId, -1)} className="flex-1 flex items-center justify-center gap-1 bg-gray-700 hover:bg-gray-600 py-2 rounded text-xs text-gray-300 transition-colors"><ArrowUp size={14} /> 上移</button>
            <button onClick={() => moveNodeOrder(nodeId, 1)} className="flex-1 flex items-center justify-center gap-1 bg-gray-700 hover:bg-gray-600 py-2 rounded text-xs text-gray-300 transition-colors"><ArrowDown size={14} /> 下移</button>
        </div>
        <div className="space-y-3">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1"><Clock size={14} /> 时间属性</label>
          <div className="flex rounded-md bg-gray-700 p-1">
              {[{ id: null, label: '无' }, { id: 'ddl', label: '截止时间' }, { id: 'schedule', label: '日程' }].map(type => (
                  <button key={String(type.id)} onClick={() => updateNodeData(nodeId, { timeType: type.id })} className={`flex-1 text-xs py-1.5 rounded transition-all ${node.timeType === type.id ? 'bg-gray-600 shadow-sm text-blue-300 font-medium' : 'text-gray-400 hover:text-gray-200'}`}>{type.label}</button>
              ))}
          </div>
          {node.timeType === 'ddl' && (
              <div className="animate-in fade-in zoom-in duration-200">
                  <label className="text-[10px] text-gray-500 mb-1 block">截止日期</label>
                  <div className="flex items-center gap-2">
                     <input type={isFullDateTime ? "datetime-local" : "date"} value={node.ddl || ''} onChange={(e) => updateNodeData(nodeId, { ddl: e.target.value })} className="flex-1 border border-gray-600 bg-gray-900 text-gray-200 rounded px-3 py-2 text-sm focus:border-blue-500 outline-none" />
                     {!isFullDateTime && (<button onClick={handleTimeAdd} className="px-2 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded text-xs whitespace-nowrap" title="添加具体时间">+ 时间</button>)}
                  </div>
              </div>
          )}
          {node.timeType === 'schedule' && (
              <div className="space-y-2 animate-in fade-in zoom-in duration-200">
                   <div className="flex items-center gap-2 mb-2">
                       <input type="checkbox" id="showTime" checked={!!node.showSpecificTime} onChange={(e) => updateNodeData(nodeId, { showSpecificTime: e.target.checked })} />
                       <label htmlFor="showTime" className="text-xs text-gray-500">在卡片上显示具体时间点</label>
                   </div>
                   <div>
                        <label className="text-[10px] text-gray-500 mb-1 block">开始时间</label>
                        <input type="datetime-local" value={node.scheduleStart || ''} onChange={(e) => updateNodeData(nodeId, { scheduleStart: e.target.value })} className="w-full border border-gray-600 bg-gray-900 text-gray-200 rounded px-3 py-2 text-sm focus:border-blue-500 outline-none" />
                   </div>
                   <div>
                        <label className="text-[10px] text-gray-500 mb-1 block">结束时间</label>
                        <input type="datetime-local" value={node.scheduleEnd || ''} onChange={(e) => updateNodeData(nodeId, { scheduleEnd: e.target.value })} className="w-full border border-gray-600 bg-gray-900 text-gray-200 rounded px-3 py-2 text-sm focus:border-blue-500 outline-none" />
                   </div>
              </div>
          )}
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1"><Zap size={14} /> 消耗精力</label>
            {node.energy > 0 && <button onClick={() => updateNodeData(nodeId, { energy: 0 })} className="text-[10px] text-gray-500 hover:text-red-400 underline">清除</button>}
          </div>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map(level => (
              <button key={level} onClick={() => updateNodeData(nodeId, { energy: node.energy === level ? 0 : level })} className={`flex-1 h-8 rounded-md border flex items-center justify-center transition-all ${node.energy >= level ? 'bg-yellow-900/50 border-yellow-500 text-yellow-300' : 'bg-gray-900 border-gray-700 text-gray-500 hover:bg-gray-700'}`}>
                <Zap size={14} fill={node.energy >= level ? "currentColor" : "none"} />
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1"><AlignLeft size={14} /> 备注</label>
          <textarea rows={5} value={node.notes || ''} onChange={(e) => updateNodeData(nodeId, { notes: e.target.value })} className="w-full border border-gray-600 bg-gray-900 text-gray-200 rounded px-3 py-2 text-sm focus:border-blue-500 outline-none resize-none" placeholder="添加详细说明..." />
        </div>
        </>
        )}
      </div>
      <div className="p-4 border-t border-gray-700 bg-gray-900">
         <button onClick={(e) => { e.stopPropagation(); deleteNode(nodeId); }} className="w-full flex items-center justify-center gap-2 text-red-400 bg-gray-800 border border-red-900/50 hover:bg-red-900/20 py-2 px-4 rounded-md text-sm transition-colors"><Trash2 size={16} /> 删除此节点</button>
      </div>
    </div>
  );
};

// --- 主应用组件 ---
export default function MindMapTaskApp() {
  // --- LocalStorage 读取数据 ---
  const [pages, setPages] = useState(() => {
    const saved = localStorage.getItem('mindtask-pages');
    return saved ? JSON.parse(saved) : INITIAL_DATA.pages;
  });

  const [activePageId, setActivePageId] = useState(() => {
     return localStorage.getItem('mindtask-activePageId') || INITIAL_PAGE_ID;
  });

  const [nodes, setNodes] = useState(() => {
    const saved = localStorage.getItem('mindtask-nodes');
    return saved ? JSON.parse(saved) : INITIAL_DATA.nodes;
  });
  
  const [history, setHistory] = useState([]); 
  const [focusedNodeId, setFocusedNodeId] = useState(null);
  const [showCompleted, setShowCompleted] = useState(true);
  const [editingPageId, setEditingPageId] = useState(null);
  const [viewMode, setViewMode] = useState('map'); 
  const [projectEnergyFilter, setProjectEnergyFilter] = useState(0); 

  const [transform, setTransform] = useState({ x: 50, y: 50, scale: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef(null); 

  // --- 监听数据变化并自动保存 ---
  useEffect(() => {
    localStorage.setItem('mindtask-pages', JSON.stringify(pages));
  }, [pages]);

  useEffect(() => {
    localStorage.setItem('mindtask-nodes', JSON.stringify(nodes));
  }, [nodes]);
  
  useEffect(() => {
    localStorage.setItem('mindtask-activePageId', activePageId);
  }, [activePageId]);

  // 辅助：计算节点深度
  const getNodeDepth = (targetId, currentNodes) => {
      let depth = 0;
      let current = currentNodes[targetId];
      while (current && current.parentId && !current.isRoot) {
          depth++;
          current = currentNodes[current.parentId];
      }
      return depth;
  };

  useEffect(() => { setFocusedNodeId(null); }, [activePageId]);

  const handleNodeFocus = (nodeId) => {
      setFocusedNodeId(nodeId);
      if (nodes[nodeId]?.isNew) {
          setNodes(prev => ({ ...prev, [nodeId]: { ...prev[nodeId], isNew: false } }));
      }
  };

  const setNodesWithHistory = (newNodesOrFn) => {
      setHistory(prev => [...prev.slice(-20), nodes]); 
      setNodes(newNodesOrFn);
  };
  const handleUndo = () => {
      if (history.length === 0) return;
      const previousNodes = history[history.length - 1];
      setHistory(prev => prev.slice(0, -1));
      setNodes(previousNodes);
  };
  useEffect(() => {
      const handleGlobalKeyDown = (e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); handleUndo(); } };
      window.addEventListener('keydown', handleGlobalKeyDown);
      return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [history, nodes]);

  const updateNodeText = (nodeId, newText) => setNodes(prev => ({ ...prev, [nodeId]: { ...prev[nodeId], text: newText } })); 
  const updateNodeData = (nodeId, data) => setNodesWithHistory(prev => ({ ...prev, [nodeId]: { ...prev[nodeId], ...data } }));
  const toggleComplete = (nodeId) => setNodesWithHistory(prev => ({ ...prev, [nodeId]: { ...prev[nodeId], completed: !prev[nodeId].completed } }));

  const changeViewMode = (mode) => {
      if (mode === viewMode) setViewMode('map');
      else setViewMode(mode);
      setFocusedNodeId(null);
  };

  const findPageIdForNode = (targetNodeId, currentNodes) => {
      let current = currentNodes[targetNodeId];
      while (current && current.parentId) { current = currentNodes[current.parentId]; }
      if (current && current.isRoot) { const page = pages.find(p => p.rootId === current.id); return page ? page.id : null; }
      return null;
  };
  const jumpToTask = (nodeId) => {
      const targetPageId = findPageIdForNode(nodeId, nodes);
      if (targetPageId && targetPageId !== activePageId) { setActivePageId(targetPageId); }
      setViewMode('map');
      setTimeout(() => setFocusedNodeId(nodeId), 50);
  };

  const addSiblingNode = (currentNodeId) => {
    const currentNode = nodes[currentNodeId];
    if (currentNode.isRoot) return; 
    const parentId = currentNode.parentId;
    const parent = nodes[parentId];
    const newNodeId = generateId();
    const newNode = { id: newNodeId, text: '', children: [], parentId: parentId, collapsed: false, isNew: true, completed: false, energy: 0, timeType: null, ddl: '', scheduleStart: '', scheduleEnd: '', notes: '', plannedSlots: [], isHeading: false };
    const currentIndex = parent.children.indexOf(currentNodeId);
    const newChildren = [...parent.children];
    newChildren.splice(currentIndex + 1, 0, newNodeId);
    setNodesWithHistory(prev => ({ ...prev, [newNodeId]: newNode, [parentId]: { ...prev[parentId], children: newChildren } }));
    setFocusedNodeId(newNodeId);
  };
  const addChildNode = (parentId) => {
    const newNodeId = generateId();
    const newNode = { id: newNodeId, text: '', children: [], parentId: parentId, collapsed: false, isNew: true, completed: false, energy: 0, timeType: null, ddl: '', scheduleStart: '', scheduleEnd: '', notes: '', plannedSlots: [], isHeading: false };
    setNodesWithHistory(prev => ({ ...prev, [newNodeId]: newNode, [parentId]: { ...prev[parentId], children: [...prev[parentId].children, newNodeId], collapsed: false } }));
    setFocusedNodeId(newNodeId);
  };
  const createPlannerTask = (taskData) => {
      const newNodeId = generateId();
      const newNode = { id: newNodeId, text: '', children: [], parentId: PLANNER_HIDDEN_ROOT_ID, collapsed: false, isNew: true, completed: false, energy: 0, timeType: 'schedule', ddl: '', scheduleStart: '', scheduleEnd: '', notes: '', plannedSlots: [], isHeading: false, ...taskData };
      setNodesWithHistory(prev => ({ ...prev, [newNodeId]: newNode }));
  };
  const outdentNode = (nodeId) => {
    const node = nodes[nodeId];
    if (node.isRoot) return;
    const parent = nodes[node.parentId];
    if (parent.isRoot) return; 
    const grandParentId = parent.parentId;
    const grandParent = nodes[grandParentId];
    const newParentChildren = parent.children.filter(id => id !== nodeId);
    const parentIndex = grandParent.children.indexOf(node.parentId);
    const newGrandParentChildren = [...grandParent.children];
    newGrandParentChildren.splice(parentIndex + 1, 0, nodeId);
    setNodesWithHistory(prev => ({ ...prev, [node.parentId]: { ...prev[node.parentId], children: newParentChildren }, [grandParentId]: { ...prev[grandParentId], children: newGrandParentChildren }, [nodeId]: { ...prev[nodeId], parentId: grandParentId } }));
  };
  const deleteNode = (nodeId) => {
    const node = nodes[nodeId];
    if (node.isRoot) { alert("根节点不能删除"); return; }
    const nodesToDelete = new Set();
    const collect = (id) => { if(nodesToDelete.has(id)) return; nodesToDelete.add(id); const n = nodes[id]; if(n && n.children) n.children.forEach(childId => collect(childId)); };
    collect(nodeId);
    if (nodesToDelete.size > 1) { if(!window.confirm(`确定要删除此任务及其 ${nodesToDelete.size - 1} 个子任务吗？`)) return; }
    setNodesWithHistory(prev => {
        const next = { ...prev };
        const parentId = node.parentId;
        if (parentId && parentId !== PLANNER_HIDDEN_ROOT_ID && next[parentId]) { next[parentId] = { ...next[parentId], children: next[parentId].children.filter(id => id !== nodeId) }; }
        nodesToDelete.forEach(id => { delete next[id]; });
        return next;
    });
    setFocusedNodeId(null);
  };
  const toggleCollapse = (nodeId) => setNodes(prev => ({ ...prev, [nodeId]: { ...prev[nodeId], collapsed: !prev[nodeId].collapsed } }));
  const onDragStart = (nodeId) => {};
  const onDrop = (draggedNodeId, targetNodeId) => {
    if (draggedNodeId === targetNodeId) return;
    let current = nodes[targetNodeId];
    while(current) { if(current.id === draggedNodeId) { alert("不能将节点拖拽到自己的子任务中"); return; } if(!current.parentId) break; current = nodes[current.parentId]; }
    const draggedNode = nodes[draggedNodeId];
    const oldParent = nodes[draggedNode.parentId];
    let nextNodes = { ...nodes };
    if (oldParent) { const oldParentChildren = oldParent.children.filter(id => id !== draggedNodeId); nextNodes[oldParent.id] = { ...oldParent, children: oldParentChildren }; }
    const targetNode = nodes[targetNodeId];
    const newTargetChildren = [...targetNode.children, draggedNodeId];
    nextNodes[targetNodeId] = { ...targetNode, children: newTargetChildren, collapsed: false };
    nextNodes[draggedNodeId] = { ...draggedNode, parentId: targetNodeId };
    setNodesWithHistory(nextNodes); 
  };
  const moveNodeOrder = (nodeId, direction) => {
     const node = nodes[nodeId];
     if(node.isRoot) return;
     const parent = nodes[node.parentId];
     const currentIndex = parent.children.indexOf(nodeId);
     const newIndex = currentIndex + direction;
     if(newIndex < 0 || newIndex >= parent.children.length) return;
     const newChildren = [...parent.children];
     [newChildren[currentIndex], newChildren[newIndex]] = [newChildren[newIndex], newChildren[currentIndex]];
     setNodesWithHistory(prev => ({ ...prev, [parent.id]: { ...prev[parent.id], children: newChildren } }));
  };
  const updatePageTitle = (pageId, newTitle) => setPages(prev => prev.map(p => p.id === pageId ? { ...p, title: newTitle } : p));
  const handleKeyDown = (e, nodeId) => { if (e.key === 'Enter') { if(e.shiftKey) return; e.preventDefault(); addSiblingNode(nodeId); } else if (e.key === 'Tab') { e.preventDefault(); if (e.shiftKey) outdentNode(nodeId); else addChildNode(nodeId); } };
  useEffect(() => {
    const handleGlobalMouseUp = () => setIsDragging(false);
    if (isDragging) { window.addEventListener('mouseup', handleGlobalMouseUp); window.addEventListener('mouseleave', handleGlobalMouseUp); }
    return () => { window.removeEventListener('mouseup', handleGlobalMouseUp); window.removeEventListener('mouseleave', handleGlobalMouseUp); };
  }, [isDragging]);
  const handleWheel = (e) => { if (e.ctrlKey) { e.preventDefault(); const delta = -e.deltaY * 0.001; const newScale = Math.min(Math.max(transform.scale + delta, 0.1), 3); setTransform(prev => ({ ...prev, scale: newScale })); } else { setTransform(prev => ({ ...prev, x: prev.x - e.deltaX, y: prev.y - e.deltaY })); } };
  const handleMouseDown = (e) => {
    const targetTag = e.target.tagName.toLowerCase();
    if (!e.target.closest('.node-card') && !e.target.closest('button') && !e.target.closest('input') && !e.target.closest('textarea')) {
      setFocusedNodeId(null);
      setIsDragging(true);
      setDragStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
    }
  };
  const handleMouseMove = (e) => { if (isDragging) setTransform({ ...transform, x: e.clientX - dragStart.x, y: e.clientY - dragStart.y }); };
  const addNewPage = () => {
    const newRootId = generateId(); const newPageId = generateId();
    const newPage = { id: newPageId, title: '新项目', rootId: newRootId };
    const newRootNode = { id: newRootId, text: '新项目目标', children: [], parentId: null, isRoot: true, collapsed: false, completed: false, energy: 0, timeType: null, ddl: '', scheduleStart: '', scheduleEnd: '', notes: '', plannedSlots: [], isHeading: false };
    setNodes(prev => ({ ...prev, [newRootId]: newRootNode })); setPages(prev => [...prev, newPage]); setActivePageId(newPageId);
  };

  const activePage = pages.find(p => p.id === activePageId);
  const activeRootId = activePage ? activePage.rootId : null;
  
  const currentDepth = focusedNodeId ? getNodeDepth(focusedNodeId, nodes) : 0;

  return (
    <div className="flex h-screen w-full bg-gray-900 text-gray-200 overflow-hidden font-sans selection:bg-blue-500/30">
      <div className="w-64 bg-gray-900 border-r border-gray-700 flex flex-col flex-shrink-0 z-20 shadow-sm">
        <div className="p-4 border-b border-gray-700 flex items-center justify-between cursor-pointer" onClick={() => changeViewMode('map')} title="返回默认视图"><h1 className="font-bold text-lg text-gray-200 flex items-center gap-2"><Layout className="w-5 h-5 text-blue-400" />MindTask</h1></div>
        <div className="flex-1 overflow-y-auto p-2">
             <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-2 mt-2">视图切换</div>
             <button onClick={() => changeViewMode('split')} className={`w-full flex items-center px-3 py-2 mb-1 rounded-md text-sm transition-colors ${viewMode === 'split' ? 'bg-purple-900/30 text-purple-300 font-medium' : 'text-gray-400 hover:bg-gray-800'}`}><Columns size={16} className="mr-2" />日程规划</button>
             <button onClick={() => changeViewMode('sorter')} className={`w-full flex items-center px-3 py-2 mb-2 rounded-md text-sm transition-colors ${viewMode === 'sorter' ? 'bg-green-900/30 text-green-300 font-medium' : 'text-gray-400 hover:bg-gray-800'}`}><Filter size={16} className="mr-2" />排序筛选</button>
             <div className="px-3 py-2 flex items-center gap-2 text-sm text-gray-400 border-t border-gray-700 mt-2 pt-4">
                 <input type="checkbox" checked={showCompleted} onChange={(e) => setShowCompleted(e.target.checked)} className="rounded text-blue-500 bg-gray-700 border-gray-600" /> 显示已完成
             </div>
             {history.length > 0 && (
                 <div className="px-3 py-1">
                     <button onClick={handleUndo} className="flex items-center gap-1 text-xs text-gray-500 hover:text-blue-400"><Undo size={12}/> 撤销 (Ctrl+Z)</button>
                 </div>
             )}
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-2 mt-4">项目列表</div>
          {pages.map(page => (
            <div key={page.id} onClick={() => setActivePageId(page.id)} onDoubleClick={() => setEditingPageId(page.id)} className={`flex items-center px-3 py-2 rounded-md cursor-pointer mb-1 text-sm transition-colors group ${activePageId === page.id ? 'bg-blue-900/30 text-blue-300 font-medium' : 'text-gray-400 hover:bg-gray-800'}`}>
              <Folder size={16} className="mr-2 opacity-70 flex-shrink-0" />
              {editingPageId === page.id ? (<input autoFocus type="text" value={page.title} onChange={(e) => updatePageTitle(page.id, e.target.value)} onBlur={() => setEditingPageId(null)} onKeyDown={(e) => e.key === 'Enter' && setEditingPageId(null)} className="bg-gray-700 border border-gray-600 rounded px-1 w-full outline-none text-gray-200" />) : (<span className="truncate w-full">{page.title}</span>)}
              {editingPageId !== page.id && (<Edit2 size={12} className="ml-auto opacity-0 group-hover:opacity-50" />)}
            </div>
          ))}
        </div>
        <div className="p-3 border-t border-gray-700"><button onClick={addNewPage} className="w-full flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-200 py-2 px-4 rounded-md text-sm transition-colors"><Plus size={16} /> 新建项目</button></div>
      </div>

      {viewMode === 'sorter' ? (
          <SorterView nodes={nodes} updateNodeData={updateNodeData} jumpToTask={jumpToTask} />
      ) : (
          <div className="flex-1 flex overflow-hidden relative">
            <div ref={containerRef} className="flex-1 relative bg-gray-900 overflow-hidden cursor-grab active:cursor-grabbing" onWheel={handleWheel} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove}>
                <div className="absolute top-0 left-0 origin-top-left transition-transform duration-75 ease-out" style={{ transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`, width: '400%', height: '400%', left: '-150%', top: '-150%', backgroundImage: 'radial-gradient(#475569 1.5px, transparent 1.5px)', backgroundSize: '24px 24px', pointerEvents: 'none' }} />
                
                <div className="absolute top-4 left-4 z-30 bg-gray-900/90 backdrop-blur p-1.5 rounded-lg shadow border border-gray-700 flex items-center gap-2 text-xs" onMouseDown={(e) => e.stopPropagation()}>
                    <span className="text-gray-400 font-medium px-1">精力过滤:</span>
                    <button onClick={() => setProjectEnergyFilter(0)} className={`px-2 py-0.5 rounded ${projectEnergyFilter === 0 ? 'bg-gray-700 text-white' : 'hover:bg-gray-800 text-gray-400'}`}>全</button>
                    {[1,2,3,4,5].map(l => (
                        <button key={l} onClick={() => setProjectEnergyFilter(l)} className={`w-5 h-5 flex items-center justify-center rounded ${projectEnergyFilter === l ? 'bg-yellow-600 text-white' : 'hover:bg-gray-800 text-gray-400'}`}>{l}</button>
                    ))}
                </div>

                <div className="absolute top-0 left-0 origin-top-left transition-transform duration-75 ease-out" style={{ transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`, width: '0px', height: '0px', overflow: 'visible' }}>
                    <div className={`pt-20 pl-20 inline-block whitespace-nowrap`}>
                        {activeRootId && nodes[activeRootId] && (
                        <MindMapNode nodeId={activeRootId} nodes={nodes} updateNodeText={updateNodeText} toggleComplete={toggleComplete} onKeyDown={handleKeyDown} onFocus={handleNodeFocus} toggleCollapse={toggleCollapse} addChildNode={addChildNode} focusedNodeId={focusedNodeId} onDragStart={onDragStart} onDrop={onDrop} energyFilter={projectEnergyFilter} showCompleted={showCompleted} />
                        )}
                    </div>
                </div>
                <div className="absolute top-4 right-4 z-30 bg-gray-900 p-2 rounded-lg shadow-md border border-gray-700 flex items-center gap-2" onMouseDown={(e) => e.stopPropagation()}>
                    <button className="p-1.5 hover:bg-gray-800 rounded text-gray-400" onClick={() => setTransform(prev => ({ ...prev, scale: prev.scale + 0.1 }))}><Maximize size={18} /></button>
                    <span className="text-xs text-gray-400 w-8 text-center">{Math.round(transform.scale * 100)}%</span>
                    <button className="p-1.5 hover:bg-gray-800 rounded text-gray-400" onClick={() => setTransform(prev => ({ ...prev, scale: Math.max(0.1, prev.scale - 0.1) }))}><Minimize size={18} /></button>
                    <div className="w-px h-4 bg-gray-700 mx-1" />
                    <button className="p-1.5 hover:bg-gray-800 rounded text-gray-400" onClick={() => setTransform({ x: 50, y: 50, scale: 1 })}><MousePointer2 size={18} /></button>
                </div>
            </div>

            {viewMode === 'split' && (
                <PlannerBoard nodes={nodes} updateNodeData={updateNodeData} createPlannerTask={createPlannerTask} updateNodeText={updateNodeText} jumpToTask={jumpToTask} deleteNode={deleteNode} />
            )}
          </div>
      )}

      {focusedNodeId && nodes[focusedNodeId] && !nodes[focusedNodeId].isRoot && (
        <PropertiesPanel nodeId={focusedNodeId} node={nodes[focusedNodeId]} updateNodeText={updateNodeText} updateNodeData={updateNodeData} moveNodeOrder={moveNodeOrder} deleteNode={deleteNode} onClose={() => setFocusedNodeId(null)} depth={currentDepth} />
      )}
    </div>
  );
}