import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Box, Popover, IconButton, TextField, Typography, Tooltip } from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import SearchIcon from '@mui/icons-material/Search';
import { Icon } from '@iconify/react';

// Register icons for offline use
import './iconRegistry';

// Emoji item with name for search and tooltip
interface EmojiItem {
    emoji: string;
    name: string;
}

// Emoji categories with names for search
const EMOJI_SECTIONS: Record<string, EmojiItem[]> = {
    'Common': [
        { emoji: '📁', name: 'Folder' }, { emoji: '📂', name: 'Open Folder' }, { emoji: '📚', name: 'Books' }, { emoji: '📖', name: 'Book' },
        { emoji: '📝', name: 'Note' }, { emoji: '📋', name: 'Clipboard' }, { emoji: '💼', name: 'Briefcase' }, { emoji: '🗂️', name: 'Files' },
        { emoji: '📦', name: 'Package' }, { emoji: '💻', name: 'Laptop' }, { emoji: '📊', name: 'Chart' }, { emoji: '📧', name: 'Email' },
        { emoji: '⭐', name: 'Star' }, { emoji: '❤️', name: 'Heart' }, { emoji: '🔥', name: 'Fire' }, { emoji: '💡', name: 'Idea' },
        { emoji: '🎯', name: 'Target' }, { emoji: '💎', name: 'Diamond' }, { emoji: '🏷️', name: 'Tag' }, { emoji: '📌', name: 'Pin' },
        { emoji: '🔖', name: 'Bookmark' }, { emoji: '📎', name: 'Clip' }, { emoji: '✏️', name: 'Pencil' }, { emoji: '🖊️', name: 'Pen' },
    ],
    'Smileys': [
        { emoji: '😀', name: 'Grinning' }, { emoji: '😃', name: 'Smiley' }, { emoji: '😄', name: 'Smile' }, { emoji: '😁', name: 'Grin' },
        { emoji: '😅', name: 'Sweat Smile' }, { emoji: '😂', name: 'Joy' }, { emoji: '🤣', name: 'ROFL' }, { emoji: '😊', name: 'Blush' },
        { emoji: '😇', name: 'Innocent' }, { emoji: '🙂', name: 'Slight Smile' }, { emoji: '😉', name: 'Wink' }, { emoji: '😌', name: 'Relieved' },
        { emoji: '🥰', name: 'Love' }, { emoji: '😍', name: 'Heart Eyes' }, { emoji: '🤩', name: 'Star Struck' }, { emoji: '😎', name: 'Cool' },
        { emoji: '🤔', name: 'Thinking' }, { emoji: '🤗', name: 'Hugging' }, { emoji: '🤭', name: 'Giggle' }, { emoji: '😏', name: 'Smirk' },
        { emoji: '🙃', name: 'Upside Down' }, { emoji: '😶', name: 'Silent' }, { emoji: '😴', name: 'Sleeping' }, { emoji: '🥳', name: 'Party' },
    ],
    'Nature': [
        { emoji: '🌱', name: 'Seedling' }, { emoji: '🌿', name: 'Herb' }, { emoji: '🌻', name: 'Sunflower' }, { emoji: '🌳', name: 'Tree' },
        { emoji: '🍀', name: 'Clover' }, { emoji: '🌈', name: 'Rainbow' }, { emoji: '🌙', name: 'Moon' }, { emoji: '☀️', name: 'Sun' },
        { emoji: '💧', name: 'Water' }, { emoji: '🌸', name: 'Cherry Blossom' }, { emoji: '🌺', name: 'Hibiscus' }, { emoji: '🌹', name: 'Rose' },
        { emoji: '🍃', name: 'Leaf' }, { emoji: '🌲', name: 'Pine' }, { emoji: '🏔️', name: 'Mountain' }, { emoji: '🌊', name: 'Wave' },
        { emoji: '🌤️', name: 'Partly Sunny' }, { emoji: '🌧️', name: 'Rain' }, { emoji: '❄️', name: 'Snow' }, { emoji: '🍁', name: 'Maple Leaf' },
        { emoji: '🌵', name: 'Cactus' }, { emoji: '🌴', name: 'Palm' }, { emoji: '🪴', name: 'Plant' }, { emoji: '🔥', name: 'Fire' },
    ],
    'Animals': [
        { emoji: '🐱', name: 'Cat' }, { emoji: '🐶', name: 'Dog' }, { emoji: '🦊', name: 'Fox' }, { emoji: '🐰', name: 'Rabbit' },
        { emoji: '🐻', name: 'Bear' }, { emoji: '🦁', name: 'Lion' }, { emoji: '🐯', name: 'Tiger' }, { emoji: '🦄', name: 'Unicorn' },
        { emoji: '🐦', name: 'Bird' }, { emoji: '🦋', name: 'Butterfly' }, { emoji: '🐸', name: 'Frog' }, { emoji: '🐵', name: 'Monkey' },
        { emoji: '🐼', name: 'Panda' }, { emoji: '🦉', name: 'Owl' }, { emoji: '🐝', name: 'Bee' }, { emoji: '🐞', name: 'Ladybug' },
        { emoji: '🐢', name: 'Turtle' }, { emoji: '🐬', name: 'Dolphin' }, { emoji: '🦈', name: 'Shark' }, { emoji: '🐙', name: 'Octopus' },
        { emoji: '🦀', name: 'Crab' }, { emoji: '🐧', name: 'Penguin' }, { emoji: '🦅', name: 'Eagle' }, { emoji: '🐺', name: 'Wolf' },
    ],
    'Food': [
        { emoji: '☕', name: 'Coffee' }, { emoji: '🍵', name: 'Tea' }, { emoji: '🍎', name: 'Apple' }, { emoji: '🍕', name: 'Pizza' },
        { emoji: '🍔', name: 'Burger' }, { emoji: '🥗', name: 'Salad' }, { emoji: '🍰', name: 'Cake' }, { emoji: '🍪', name: 'Cookie' },
        { emoji: '🍩', name: 'Donut' }, { emoji: '🧁', name: 'Cupcake' }, { emoji: '🍓', name: 'Strawberry' }, { emoji: '🍇', name: 'Grapes' },
        { emoji: '🥐', name: 'Croissant' }, { emoji: '🧀', name: 'Cheese' }, { emoji: '🍿', name: 'Popcorn' }, { emoji: '🍫', name: 'Chocolate' },
        { emoji: '🍺', name: 'Beer' }, { emoji: '🍷', name: 'Wine' }, { emoji: '🥤', name: 'Drink' }, { emoji: '🧃', name: 'Juice' },
        { emoji: '🍜', name: 'Noodles' }, { emoji: '🍣', name: 'Sushi' }, { emoji: '🥟', name: 'Dumpling' }, { emoji: '🌮', name: 'Taco' },
    ],
    'Activities': [
        { emoji: '⚽', name: 'Soccer' }, { emoji: '🏀', name: 'Basketball' }, { emoji: '🎾', name: 'Tennis' }, { emoji: '🎮', name: 'Gaming' },
        { emoji: '🎯', name: 'Darts' }, { emoji: '🎨', name: 'Art' }, { emoji: '🎭', name: 'Theater' }, { emoji: '🎪', name: 'Circus' },
        { emoji: '🎸', name: 'Guitar' }, { emoji: '🎹', name: 'Piano' }, { emoji: '🎺', name: 'Trumpet' }, { emoji: '🎻', name: 'Violin' },
        { emoji: '🎲', name: 'Dice' }, { emoji: '🧩', name: 'Puzzle' }, { emoji: '🎬', name: 'Movie' }, { emoji: '📷', name: 'Camera' },
        { emoji: '🎤', name: 'Microphone' }, { emoji: '🎧', name: 'Headphones' }, { emoji: '🎵', name: 'Music' }, { emoji: '🎶', name: 'Notes' },
        { emoji: '🏆', name: 'Trophy' }, { emoji: '🥇', name: 'Gold Medal' }, { emoji: '🎖️', name: 'Medal' }, { emoji: '🏅', name: 'Sports Medal' },
    ],
    'Travel': [
        { emoji: '✈️', name: 'Airplane' }, { emoji: '🚗', name: 'Car' }, { emoji: '🚀', name: 'Rocket' }, { emoji: '🛸', name: 'UFO' },
        { emoji: '⛵', name: 'Sailboat' }, { emoji: '🚁', name: 'Helicopter' }, { emoji: '🏠', name: 'Home' }, { emoji: '🏢', name: 'Office' },
        { emoji: '🏛️', name: 'Museum' }, { emoji: '⛰️', name: 'Mountain' }, { emoji: '🏖️', name: 'Beach' }, { emoji: '🌅', name: 'Sunrise' },
        { emoji: '🗼', name: 'Tower' }, { emoji: '🎡', name: 'Ferris Wheel' }, { emoji: '🚂', name: 'Train' }, { emoji: '🚲', name: 'Bicycle' },
        { emoji: '🛩️', name: 'Small Plane' }, { emoji: '🚢', name: 'Ship' }, { emoji: '🏰', name: 'Castle' }, { emoji: '🗽', name: 'Statue' },
        { emoji: '🌉', name: 'Bridge' }, { emoji: '⛺', name: 'Tent' }, { emoji: '🎢', name: 'Roller Coaster' }, { emoji: '🗺️', name: 'Map' },
    ],
    'Symbols': [
        { emoji: '💚', name: 'Green Heart' }, { emoji: '💙', name: 'Blue Heart' }, { emoji: '💜', name: 'Purple Heart' }, { emoji: '🧡', name: 'Orange Heart' },
        { emoji: '💛', name: 'Yellow Heart' }, { emoji: '🖤', name: 'Black Heart' }, { emoji: '🤍', name: 'White Heart' }, { emoji: '💎', name: 'Gem' },
        { emoji: '🎁', name: 'Gift' }, { emoji: '🏆', name: 'Trophy' }, { emoji: '🔔', name: 'Bell' }, { emoji: '⚡', name: 'Lightning' },
        { emoji: '✨', name: 'Sparkles' }, { emoji: '🌟', name: 'Glowing Star' }, { emoji: '💫', name: 'Dizzy' }, { emoji: '🔮', name: 'Crystal Ball' },
        { emoji: '❗', name: 'Exclamation' }, { emoji: '❓', name: 'Question' }, { emoji: '✅', name: 'Check' }, { emoji: '❌', name: 'Cross' },
        { emoji: '⭕', name: 'Circle' }, { emoji: '🔴', name: 'Red Circle' }, { emoji: '🟢', name: 'Green Circle' }, { emoji: '🔵', name: 'Blue Circle' },
    ],
    'Objects': [
        { emoji: '💰', name: 'Money Bag' }, { emoji: '💳', name: 'Credit Card' }, { emoji: '📱', name: 'Phone' }, { emoji: '💿', name: 'CD' },
        { emoji: '📀', name: 'DVD' }, { emoji: '🖥️', name: 'Desktop' }, { emoji: '⌨️', name: 'Keyboard' }, { emoji: '🖱️', name: 'Mouse' },
        { emoji: '🔧', name: 'Wrench' }, { emoji: '🔨', name: 'Hammer' }, { emoji: '⚙️', name: 'Gear' }, { emoji: '🔩', name: 'Bolt' },
        { emoji: '🧲', name: 'Magnet' }, { emoji: '🔬', name: 'Microscope' }, { emoji: '🔭', name: 'Telescope' }, { emoji: '📡', name: 'Satellite' },
        { emoji: '💊', name: 'Pill' }, { emoji: '🩺', name: 'Stethoscope' }, { emoji: '🧪', name: 'Test Tube' }, { emoji: '🧬', name: 'DNA' },
        { emoji: '🪄', name: 'Magic Wand' }, { emoji: '🎀', name: 'Ribbon' }, { emoji: '🎈', name: 'Balloon' }, { emoji: '🎉', name: 'Party' },
    ],
};

// Flat color icons - all from flat-color-icons set (fast loading, bundled locally)
const ICON_SECTIONS: Record<string, Array<{ icon: string; name: string }>> = {
    'Social': [
        { icon: 'social:twitter', name: 'Twitter' },
        { icon: 'social:x', name: 'X' },
        { icon: 'social:github', name: 'GitHub' },
        { icon: 'social:facebook', name: 'Facebook' },
        { icon: 'social:instagram', name: 'Instagram' },
        { icon: 'social:linkedin', name: 'LinkedIn' },
        { icon: 'social:youtube', name: 'YouTube' },
        { icon: 'social:discord', name: 'Discord' },
        { icon: 'social:telegram', name: 'Telegram' },
        { icon: 'social:whatsapp', name: 'WhatsApp' },
        { icon: 'social:reddit', name: 'Reddit' },
        { icon: 'social:slack', name: 'Slack' },
        { icon: 'social:wechat', name: 'WeChat' },
        { icon: 'social:weibo', name: 'Weibo' },
        { icon: 'social:bilibili', name: 'Bilibili' },
        { icon: 'social:tiktok', name: 'TikTok' },
        { icon: 'social:mastodon', name: 'Mastodon' },
        { icon: 'social:pinterest', name: 'Pinterest' },
        { icon: 'social:spotify', name: 'Spotify' },
        { icon: 'social:medium', name: 'Medium' },
        { icon: 'social:google', name: 'Google' },
        { icon: 'social:apple', name: 'Apple' },
        { icon: 'social:microsoft', name: 'Microsoft' },
        { icon: 'social:threads', name: 'Threads' },
        { icon: 'social:rss', name: 'RSS' },
    ],
    'Files': [
        { icon: 'flat-color-icons:folder', name: 'Folder' },
        { icon: 'flat-color-icons:opened-folder', name: 'Opened Folder' },
        { icon: 'flat-color-icons:file', name: 'File' },
        { icon: 'flat-color-icons:document', name: 'Document' },
        { icon: 'flat-color-icons:image-file', name: 'Image' },
        { icon: 'flat-color-icons:audio-file', name: 'Audio' },
        { icon: 'flat-color-icons:video-file', name: 'Video' },
        { icon: 'flat-color-icons:edit-image', name: 'Edit Image' },
        { icon: 'flat-color-icons:database', name: 'Database' },
        { icon: 'flat-color-icons:data-backup', name: 'Backup' },
        { icon: 'flat-color-icons:data-protection', name: 'Data Protection' },
        { icon: 'flat-color-icons:data-configuration', name: 'Data Config' },
        { icon: 'flat-color-icons:data-sheet', name: 'Data Sheet' },
        { icon: 'flat-color-icons:data-encryption', name: 'Encryption' },
        { icon: 'flat-color-icons:add-database', name: 'Add Database' },
        { icon: 'flat-color-icons:delete-database', name: 'Delete Database' },
    ],
    'Business': [
        { icon: 'flat-color-icons:briefcase', name: 'Briefcase' },
        { icon: 'flat-color-icons:calendar', name: 'Calendar' },
        { icon: 'flat-color-icons:clock', name: 'Clock' },
        { icon: 'flat-color-icons:todo-list', name: 'Todo List' },
        { icon: 'flat-color-icons:idea', name: 'Idea' },
        { icon: 'flat-color-icons:statistics', name: 'Statistics' },
        { icon: 'flat-color-icons:pie-chart', name: 'Pie Chart' },
        { icon: 'flat-color-icons:line-chart', name: 'Line Chart' },
        { icon: 'flat-color-icons:combo-chart', name: 'Combo Chart' },
        { icon: 'flat-color-icons:bar-chart', name: 'Bar Chart' },
        { icon: 'flat-color-icons:area-chart', name: 'Area Chart' },
        { icon: 'flat-color-icons:money-transfer', name: 'Money' },
        { icon: 'flat-color-icons:conference-call', name: 'Conference' },
        { icon: 'flat-color-icons:org-unit', name: 'Organization' },
        { icon: 'flat-color-icons:department', name: 'Department' },
        { icon: 'flat-color-icons:businessman', name: 'Businessman' },
        { icon: 'flat-color-icons:manager', name: 'Manager' },
        { icon: 'flat-color-icons:planner', name: 'Planner' },
        { icon: 'flat-color-icons:currency-exchange', name: 'Exchange' },
        { icon: 'flat-color-icons:donate', name: 'Donate' },
        { icon: 'flat-color-icons:sales-performance', name: 'Sales' },
        { icon: 'flat-color-icons:approval', name: 'Approval' },
        { icon: 'flat-color-icons:rules', name: 'Rules' },
        { icon: 'flat-color-icons:survey', name: 'Survey' },
    ],
    'Communication': [
        { icon: 'flat-color-icons:sms', name: 'SMS' },
        { icon: 'flat-color-icons:phone', name: 'Phone' },
        { icon: 'flat-color-icons:voicemail', name: 'Voicemail' },
        { icon: 'flat-color-icons:faq', name: 'FAQ' },
        { icon: 'flat-color-icons:news', name: 'News' },
        { icon: 'flat-color-icons:comments', name: 'Comments' },
        { icon: 'flat-color-icons:advertising', name: 'Advertising' },
        { icon: 'flat-color-icons:collaboration', name: 'Collaboration' },
        { icon: 'flat-color-icons:invite', name: 'Invite' },
        { icon: 'flat-color-icons:reading', name: 'Reading' },
        { icon: 'flat-color-icons:reading-ebook', name: 'E-Book' },
        { icon: 'flat-color-icons:feedback', name: 'Feedback' },
        { icon: 'flat-color-icons:survey', name: 'Survey' },
        { icon: 'flat-color-icons:voice-presentation', name: 'Presentation' },
        { icon: 'flat-color-icons:video-call', name: 'Video Call' },
    ],
    'Objects': [
        { icon: 'flat-color-icons:home', name: 'Home' },
        { icon: 'flat-color-icons:shop', name: 'Shop' },
        { icon: 'flat-color-icons:globe', name: 'Globe' },
        { icon: 'flat-color-icons:bookmark', name: 'Bookmark' },
        { icon: 'flat-color-icons:graduation-cap', name: 'Education' },
        { icon: 'flat-color-icons:library', name: 'Library' },
        { icon: 'flat-color-icons:music', name: 'Music' },
        { icon: 'flat-color-icons:camera', name: 'Camera' },
        { icon: 'flat-color-icons:gallery', name: 'Gallery' },
        { icon: 'flat-color-icons:sports-mode', name: 'Sports' },
        { icon: 'flat-color-icons:like', name: 'Like' },
        { icon: 'flat-color-icons:dislike', name: 'Dislike' },
        { icon: 'flat-color-icons:rating', name: 'Rating' },
        { icon: 'flat-color-icons:assistant', name: 'Assistant' },
        { icon: 'flat-color-icons:binoculars', name: 'Binoculars' },
        { icon: 'flat-color-icons:landscape', name: 'Landscape' },
        { icon: 'flat-color-icons:puzzle', name: 'Puzzle' },
        { icon: 'flat-color-icons:podium-without-speaker', name: 'Podium' },
        { icon: 'flat-color-icons:multiple-devices', name: 'Devices' },
        { icon: 'flat-color-icons:engineering', name: 'Engineering' },
        { icon: 'flat-color-icons:tree-structure', name: 'Tree' },
        { icon: 'flat-color-icons:mind-map', name: 'Mind Map' },
        { icon: 'flat-color-icons:timeline', name: 'Timeline' },
        { icon: 'flat-color-icons:serial-tasks', name: 'Serial Tasks' },
    ],
    'Tools': [
        { icon: 'flat-color-icons:settings', name: 'Settings' },
        { icon: 'flat-color-icons:support', name: 'Support' },
        { icon: 'flat-color-icons:search', name: 'Search' },
        { icon: 'flat-color-icons:lock', name: 'Lock' },
        { icon: 'flat-color-icons:unlock', name: 'Unlock' },
        { icon: 'flat-color-icons:key', name: 'Key' },
        { icon: 'flat-color-icons:download', name: 'Download' },
        { icon: 'flat-color-icons:upload', name: 'Upload' },
        { icon: 'flat-color-icons:share', name: 'Share' },
        { icon: 'flat-color-icons:print', name: 'Print' },
        { icon: 'flat-color-icons:info', name: 'Info' },
        { icon: 'flat-color-icons:about', name: 'About' },
        { icon: 'flat-color-icons:flash-on', name: 'Flash' },
        { icon: 'flat-color-icons:command-line', name: 'Terminal' },
        { icon: 'flat-color-icons:electronics', name: 'Electronics' },
        { icon: 'flat-color-icons:automatic', name: 'Automatic' },
        { icon: 'flat-color-icons:accept-database', name: 'Accept DB' },
        { icon: 'flat-color-icons:inspection', name: 'Inspection' },
        { icon: 'flat-color-icons:template', name: 'Template' },
        { icon: 'flat-color-icons:view-details', name: 'Details' },
        { icon: 'flat-color-icons:workflow', name: 'Workflow' },
        { icon: 'flat-color-icons:process', name: 'Process' },
        { icon: 'flat-color-icons:start', name: 'Start' },
        { icon: 'flat-color-icons:end', name: 'End' },
    ],
    'Status': [
        { icon: 'flat-color-icons:ok', name: 'OK' },
        { icon: 'flat-color-icons:cancel', name: 'Cancel' },
        { icon: 'flat-color-icons:high-priority', name: 'High Priority' },
        { icon: 'flat-color-icons:medium-priority', name: 'Medium Priority' },
        { icon: 'flat-color-icons:low-priority', name: 'Low Priority' },
        { icon: 'flat-color-icons:checkmark', name: 'Checkmark' },
        { icon: 'flat-color-icons:plus', name: 'Plus' },
        { icon: 'flat-color-icons:minus', name: 'Minus' },
        { icon: 'flat-color-icons:services', name: 'Services' },
        { icon: 'flat-color-icons:shipped', name: 'Shipped' },
        { icon: 'flat-color-icons:in-transit', name: 'In Transit' },
        { icon: 'flat-color-icons:paid', name: 'Paid' },
        { icon: 'flat-color-icons:overtime', name: 'Overtime' },
        { icon: 'flat-color-icons:expired', name: 'Expired' },
        { icon: 'flat-color-icons:leave', name: 'Leave' },
        { icon: 'flat-color-icons:internal', name: 'Internal' },
    ],
};

const ALL_EMOJIS = Object.values(EMOJI_SECTIONS).flat();
const ALL_ICONS = Object.values(ICON_SECTIONS).flat();

export interface IconValue {
    type: 'emoji' | 'icon';
    value: string; // emoji char or iconify icon name
}

interface IconPickerProps {
    value?: IconValue | string | null;
    onChange: (icon: IconValue | null) => void;
    defaultIcon?: React.ReactNode;
    size?: 'small' | 'medium' | 'large';
}

const IconPicker: React.FC<IconPickerProps> = ({
    value,
    onChange,
    defaultIcon = <FolderIcon sx={{ fontSize: 18 }} />,
    size = 'medium',
}) => {
    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
    const [search, setSearch] = useState('');
    const [activeTab, setActiveTab] = useState<'emoji' | 'icon'>('emoji');
    const searchInputRef = useRef<HTMLInputElement>(null);

    const buttonSize = size === 'small' ? 32 : size === 'large' ? 56 : 40;
    const iconSize = size === 'small' ? 18 : size === 'large' ? 28 : 22;

    // Normalize value
    const normalizedValue: IconValue | null = useMemo(() => {
        if (!value) return null;
        if (typeof value === 'string') {
            // Check if it looks like an iconify icon (contains colon)
            if (value.includes(':')) {
                return { type: 'icon', value };
            }
            return { type: 'emoji', value };
        }
        return value;
    }, [value]);

    const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
        setSearch('');
        // Set initial tab based on current value
        if (normalizedValue?.type === 'icon') {
            setActiveTab('icon');
        } else {
            setActiveTab('emoji');
        }
    };

    const handleClose = () => {
        setAnchorEl(null);
        setSearch('');
    };

    const handleSelectEmoji = (emoji: string) => {
        onChange({ type: 'emoji', value: emoji });
        handleClose();
    };

    const handleSelectIcon = (iconName: string) => {
        onChange({ type: 'icon', value: iconName });
        handleClose();
    };

    const handleClear = () => {
        onChange(null);
        handleClose();
    };

    // Focus search on open
    useEffect(() => {
        if (anchorEl && searchInputRef.current) {
            setTimeout(() => searchInputRef.current?.focus(), 100);
        }
    }, [anchorEl]);

    // Filter emoji sections based on search (by name)
    const filteredEmojiSections = useMemo(() => {
        if (!search.trim()) return EMOJI_SECTIONS;
        const searchLower = search.toLowerCase();
        const result: Record<string, EmojiItem[]> = {};

        Object.entries(EMOJI_SECTIONS).forEach(([section, emojis]) => {
            // Filter emojis by name match
            const matchedEmojis = emojis.filter(item =>
                item.name.toLowerCase().includes(searchLower) ||
                section.toLowerCase().includes(searchLower)
            );
            if (matchedEmojis.length > 0) {
                result[section] = matchedEmojis;
            }
        });

        // If no section matches, search all emojis by name
        if (Object.keys(result).length === 0) {
            const allMatched = ALL_EMOJIS.filter(item =>
                item.name.toLowerCase().includes(searchLower)
            );
            if (allMatched.length > 0) {
                result['Search Results'] = allMatched;
            }
        }

        return result;
    }, [search]);

    // Filter icon sections based on search
    const filteredIconSections = useMemo(() => {
        if (!search.trim()) return ICON_SECTIONS;
        const searchLower = search.toLowerCase();
        const result: Record<string, Array<{ icon: string; name: string }>> = {};

        Object.entries(ICON_SECTIONS).forEach(([section, icons]) => {
            const matchedIcons = icons.filter(i =>
                i.name.toLowerCase().includes(searchLower) ||
                section.toLowerCase().includes(searchLower)
            );
            if (matchedIcons.length > 0) {
                result[section] = matchedIcons;
            }
        });

        // If no section matches, search all icons
        if (Object.keys(result).length === 0) {
            const allMatched = ALL_ICONS.filter(i => i.name.toLowerCase().includes(searchLower));
            if (allMatched.length > 0) {
                result['Search Results'] = allMatched;
            }
        }

        return result;
    }, [search]);

    const isOpen = Boolean(anchorEl);

    // Render icon preview
    const renderIconPreview = () => {
        if (!normalizedValue) {
            return <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{defaultIcon}</Box>;
        }

        if (normalizedValue.type === 'emoji') {
            return <span style={{ fontSize: iconSize }}>{normalizedValue.value}</span>;
        }

        if (normalizedValue.type === 'icon') {
            return <Icon icon={normalizedValue.value} width={iconSize} height={iconSize} />;
        }

        return <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{defaultIcon}</Box>;
    };

    return (
        <>
            {/* Trigger button */}
            <IconButton
                onClick={handleOpen}
                sx={{
                    width: buttonSize,
                    height: buttonSize,
                    borderRadius: '8px',
                    bgcolor: 'rgba(0, 0, 0, 0.04)',
                    border: '1px solid rgba(0, 0, 0, 0.1)',
                    transition: 'all 0.15s ease',
                    '&:hover': {
                        bgcolor: 'rgba(0, 0, 0, 0.08)',
                        borderColor: 'rgba(0, 0, 0, 0.2)',
                    },
                }}
            >
                {renderIconPreview()}
            </IconButton>

            <Popover
                open={isOpen}
                anchorEl={anchorEl}
                onClose={handleClose}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                transformOrigin={{ vertical: 'top', horizontal: 'left' }}
                PaperProps={{
                    sx: {
                        mt: 0.5,
                        borderRadius: '12px',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                        border: '1px solid rgba(0,0,0,0.08)',
                        width: 400,
                        overflow: 'hidden',
                        bgcolor: '#fff',
                    },
                }}
            >
                {/* Header with tabs on left, remove on right */}
                <Box sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    px: 1.5,
                    py: 1,
                    borderBottom: '1px solid rgba(0,0,0,0.08)',
                    bgcolor: '#fafafa',
                }}>
                    {/* Left side: Tabs */}
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <TabButton active={activeTab === 'emoji'} onClick={() => setActiveTab('emoji')}>
                            Emoji
                        </TabButton>
                        <TabButton active={activeTab === 'icon'} onClick={() => setActiveTab('icon')}>
                            Icon
                        </TabButton>
                    </Box>

                    {/* Right side: Remove button with hover effect like emoji */}
                    {normalizedValue && (
                        <Box
                            onClick={handleClear}
                            sx={{
                                cursor: 'pointer',
                                color: '#9ca3af',
                                fontSize: '12px',
                                px: 1,
                                py: 0.5,
                                mr: 0.5,
                                borderRadius: '6px',
                                transition: 'all 0.15s ease',
                                '&:hover': {
                                    color: '#64748b',
                                    bgcolor: 'rgba(59, 130, 246, 0.08)',
                                },
                            }}
                        >
                            Remove
                        </Box>
                    )}
                </Box>

                {/* Search input */}
                <Box sx={{ px: 1.5, py: 1, borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                    <TextField
                        inputRef={searchInputRef}
                        placeholder={activeTab === 'emoji' ? 'Search emoji...' : 'Search icons...'}
                        size="small"
                        fullWidth
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        InputProps={{
                            startAdornment: <SearchIcon sx={{ fontSize: 18, color: '#9ca3af', mr: 0.5 }} />,
                            sx: {
                                borderRadius: '8px',
                                fontSize: '13px',
                                bgcolor: '#f3f4f6',
                                '& fieldset': { border: 'none' },
                            },
                        }}
                    />
                </Box>

                {/* Content area */}
                <Box sx={{ maxHeight: 350, overflowY: 'auto', px: 1.5, py: 1.5 }}>
                    {/* Emoji tab content */}
                    {activeTab === 'emoji' && (
                        <>
                            {Object.keys(filteredEmojiSections).length === 0 ? (
                                <Typography sx={{ p: 2, color: '#9ca3af', fontSize: '13px', textAlign: 'center' }}>
                                    No emojis found
                                </Typography>
                            ) : (
                                Object.entries(filteredEmojiSections).map(([sectionName, emojis]) => (
                                    <Box key={sectionName} sx={{ mb: 2 }}>
                                        <SectionTitle>{sectionName}</SectionTitle>
                                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                            {emojis.map((item, index) => (
                                                <EmojiButton
                                                    key={`${item.emoji}-${index}`}
                                                    emoji={item.emoji}
                                                    name={item.name}
                                                    onClick={handleSelectEmoji}
                                                />
                                            ))}
                                        </Box>
                                    </Box>
                                ))
                            )}
                        </>
                    )}

                    {/* Icon tab content */}
                    {activeTab === 'icon' && (
                        <>
                            {Object.keys(filteredIconSections).length === 0 ? (
                                <Typography sx={{ p: 2, color: '#9ca3af', fontSize: '13px', textAlign: 'center' }}>
                                    No icons found
                                </Typography>
                            ) : (
                                Object.entries(filteredIconSections).map(([sectionName, icons]) => (
                                    <Box key={sectionName} sx={{ mb: 2 }}>
                                        <SectionTitle>{sectionName}</SectionTitle>
                                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                                            {icons.map(({ icon, name }) => (
                                                <Tooltip key={icon} title={name} arrow>
                                                    <Box
                                                        onClick={() => handleSelectIcon(icon)}
                                                        sx={{
                                                            width: 36,
                                                            height: 36,
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            borderRadius: '6px',
                                                            cursor: 'pointer',
                                                            transition: 'all 0.1s ease',
                                                            border: normalizedValue?.value === icon
                                                                ? '2px solid #3b82f6'
                                                                : '2px solid transparent',
                                                            '&:hover': {
                                                                bgcolor: 'rgba(59, 130, 246, 0.08)',
                                                            },
                                                        }}
                                                    >
                                                        <Icon icon={icon} width={24} height={24} />
                                                    </Box>
                                                </Tooltip>
                                            ))}
                                        </Box>
                                    </Box>
                                ))
                            )}
                        </>
                    )}
                </Box>
            </Popover>
        </>
    );
};

// Tab button component
const TabButton: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({
    active,
    onClick,
    children,
}) => (
    <Box
        onClick={onClick}
        sx={{
            px: 1.5,
            py: 0.5,
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 500,
            color: active ? '#3b82f6' : '#64748b',
            bgcolor: active ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
            transition: 'all 0.15s ease',
            '&:hover': {
                bgcolor: active ? 'rgba(59, 130, 246, 0.15)' : 'rgba(0, 0, 0, 0.04)',
            },
        }}
    >
        {children}
    </Box>
);

// Section title component
const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <Typography
        sx={{
            fontSize: '11px',
            fontWeight: 600,
            color: '#9ca3af',
            mb: 0.75,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
        }}
    >
        {children}
    </Typography>
);

// Emoji button component with tooltip
const EmojiButton: React.FC<{ emoji: string; name: string; onClick: (e: string) => void }> = ({ emoji, name, onClick }) => (
    <Tooltip title={name} arrow>
        <Box
            onClick={() => onClick(emoji)}
            sx={{
                width: 32,
                height: 32,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '20px',
                transition: 'all 0.1s ease',
                '&:hover': {
                    bgcolor: 'rgba(59, 130, 246, 0.08)',
                    transform: 'scale(1.1)',
                },
            }}
        >
            {emoji}
        </Box>
    </Tooltip>
);

export default IconPicker;
