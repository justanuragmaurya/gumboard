"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Pencil,
  Trash2,
  Edit3,
  ChevronDown,
  Settings,
  LogOut,
  Search,
  User,
  ArrowUpDown,
  Eye,
  EyeOff,
} from "lucide-react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { FullPageLoader } from "@/components/ui/loader";
import { DateRangePicker } from "@/components/ui/date-range-picker";

interface ChecklistItem {
  id: string;
  content: string;
  checked: boolean;
  order: number;
}

interface Note {
  id: string;
  content: string;
  color: string;
  done: boolean;
  createdAt: string;
  updatedAt: string;
  isChecklist?: boolean;
  checklistItems?: ChecklistItem[];
  user: {
    id: string;
    name: string | null;
    email: string;
  };
  board?: {
    id: string;
    name: string;
  };
}

interface Board {
  id: string;
  name: string;
  description: string | null;
}

interface User {
  id: string;
  name: string | null;
  email: string;
  isAdmin: boolean;
  organization: {
    name: string;
  } | null;
}

type SortOption = "created-desc" | "created-asc" | "author-name";

const SORT_OPTIONS = [
  {
    value: "created-desc" as SortOption,
    label: "Newest first",
    description: "Created at (descending)",
  },
  {
    value: "created-asc" as SortOption,
    label: "Oldest first",
    description: "Created at (ascending)",
  },
  {
    value: "author-name" as SortOption,
    label: "Author name",
    description: "Alphabetical by name",
  },
] as const;

export default function BoardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [board, setBoard] = useState<Board | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [allBoards, setAllBoards] = useState<Board[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [showBoardDropdown, setShowBoardDropdown] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [boardId, setBoardId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateRange, setDateRange] = useState<{
    startDate: Date | null;
    endDate: Date | null;
  }>({
    startDate: null,
    endDate: null,
  });
  const [selectedAuthor, setSelectedAuthor] = useState<string | null>(null);
  const [showAuthorDropdown, setShowAuthorDropdown] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>("created-desc");
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [showDoneNotes, setShowDoneNotes] = useState(false);
  const [addingChecklistItem, setAddingChecklistItem] = useState<string | null>(
    null
  );
  const [newChecklistItemContent, setNewChecklistItemContent] = useState("");
  const [editingChecklistItem, setEditingChecklistItem] = useState<{
    noteId: string;
    itemId: string;
  } | null>(null);
  const [editingChecklistItemContent, setEditingChecklistItemContent] =
    useState("");
  const [animatingItems, setAnimatingItems] = useState<Set<string>>(new Set());
  const boardRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  // Update URL with current filter state
  const updateURL = (
    newSearchTerm?: string,
    newDateRange?: { startDate: Date | null; endDate: Date | null },
    newAuthor?: string | null,
    newSort?: SortOption,
    newShowDone?: boolean
  ) => {
    const params = new URLSearchParams();

    const currentSearchTerm =
      newSearchTerm !== undefined ? newSearchTerm : searchTerm;
    const currentDateRange =
      newDateRange !== undefined ? newDateRange : dateRange;
    const currentAuthor = newAuthor !== undefined ? newAuthor : selectedAuthor;
    const currentSort = newSort !== undefined ? newSort : sortBy;
    const currentShowDone =
      newShowDone !== undefined ? newShowDone : showDoneNotes;

    if (currentSearchTerm) {
      params.set("search", currentSearchTerm);
    }

    if (currentDateRange.startDate) {
      params.set(
        "startDate",
        currentDateRange.startDate.toISOString().split("T")[0]
      );
    }

    if (currentDateRange.endDate) {
      params.set(
        "endDate",
        currentDateRange.endDate.toISOString().split("T")[0]
      );
    }

    if (currentAuthor) {
      params.set("author", currentAuthor);
    }

    if (currentSort !== "created-desc") {
      params.set("sort", currentSort);
    }

    if (currentShowDone) {
      // Only add if not default (false)
      params.set("showDone", "true");
    }

    const queryString = params.toString();
    const newURL = queryString ? `?${queryString}` : window.location.pathname;
    router.replace(newURL, { scroll: false });
  };

  // Initialize filters from URL parameters
  const initializeFiltersFromURL = () => {
    const urlSearchTerm = searchParams.get("search") || "";
    const urlStartDate = searchParams.get("startDate");
    const urlEndDate = searchParams.get("endDate");
    const urlAuthor = searchParams.get("author");
    const urlSort = (searchParams.get("sort") as SortOption) || "created-desc";
    const urlShowDone = searchParams.get("showDone");

    // Validate sort option
    const validSortOptions: SortOption[] = [
      "created-desc",
      "created-asc",
      "author-name",
    ];
    const validSort = validSortOptions.includes(urlSort)
      ? urlSort
      : "created-desc";

    setSearchTerm(urlSearchTerm);

    // Parse dates safely
    let startDate: Date | null = null;
    let endDate: Date | null = null;

    if (urlStartDate) {
      const parsedStartDate = new Date(urlStartDate);
      if (!isNaN(parsedStartDate.getTime())) {
        startDate = parsedStartDate;
      }
    }

    if (urlEndDate) {
      const parsedEndDate = new Date(urlEndDate);
      if (!isNaN(parsedEndDate.getTime())) {
        endDate = parsedEndDate;
      }
    }

    setDateRange({ startDate, endDate });
    setSelectedAuthor(urlAuthor);
    setSortBy(validSort);
    // Default to false if not specified, otherwise parse the boolean
    setShowDoneNotes(urlShowDone === null ? false : urlShowDone === "true");
  };

  // Enhanced responsive grid configuration
  const getResponsiveConfig = () => {
    if (typeof window === "undefined")
      return {
        noteWidth: 320,
        gridGap: 20,
        containerPadding: 20,
        notePadding: 16,
      };

    const width = window.innerWidth;

    // Ultra-wide screens (1920px+)
    if (width >= 1920) {
      return {
        noteWidth: 340,
        gridGap: 24,
        containerPadding: 32,
        notePadding: 18,
      };
    }
    // Large desktop (1200px-1919px)
    else if (width >= 1200) {
      return {
        noteWidth: 320,
        gridGap: 20,
        containerPadding: 24,
        notePadding: 16,
      };
    }
    // Medium desktop/laptop (768px-1199px)
    else if (width >= 768) {
      return {
        noteWidth: 300,
        gridGap: 16,
        containerPadding: 20,
        notePadding: 16,
      };
    }
    // Small tablet (600px-767px)
    else if (width >= 600) {
      return {
        noteWidth: 280,
        gridGap: 16,
        containerPadding: 16,
        notePadding: 14,
      };
    }
    // Mobile (less than 600px)
    else {
      return {
        noteWidth: 260,
        gridGap: 12,
        containerPadding: 12,
        notePadding: 12,
      };
    }
  };

  // Helper function to calculate note height based on content
  const calculateNoteHeight = (
    note: Note,
    noteWidth?: number,
    notePadding?: number
  ) => {
    const config = getResponsiveConfig();
    const actualNotePadding = notePadding || config.notePadding;
    const actualNoteWidth = noteWidth || config.noteWidth;

    const headerHeight = 76; // User info header + margins (more accurate)
    const paddingHeight = actualNotePadding * 2; // Top and bottom padding
    const minContentHeight = 84; // Minimum content area (3 lines)

    if (note.isChecklist && note.checklistItems) {
      // For checklist items, calculate height based on number of items
      const itemHeight = 32; // Each checklist item is about 32px tall (text + padding)
      const itemSpacing = 8; // Space between items
      const checklistItemsCount = note.checklistItems.length;
      const addingItemHeight = addingChecklistItem === note.id ? 32 : 0; // Add height for input field

      const checklistHeight =
        checklistItemsCount * itemHeight +
        (checklistItemsCount - 1) * itemSpacing +
        addingItemHeight;
      const totalChecklistHeight = Math.max(minContentHeight, checklistHeight);

      return headerHeight + paddingHeight + totalChecklistHeight + 40; // Extra space for + button
    } else {
      // Original logic for regular notes
      const lines = note.content.split("\n");

      // Estimate character width and calculate text wrapping
      const avgCharWidth = 9; // Average character width in pixels
      const contentWidth = actualNoteWidth - actualNotePadding * 2 - 16; // Note width minus padding and margins
      const charsPerLine = Math.floor(contentWidth / avgCharWidth);

      // Calculate total lines including wrapped text
      let totalLines = 0;
      lines.forEach((line) => {
        if (line.length === 0) {
          totalLines += 1; // Empty line
        } else {
          const wrappedLines = Math.ceil(line.length / charsPerLine);
          totalLines += Math.max(1, wrappedLines);
        }
      });

      // Ensure minimum content
      totalLines = Math.max(3, totalLines);

      // Calculate based on actual text content with wrapping
      const lineHeight = 28; // Line height for readability (leading-7)
      const contentHeight = totalLines * lineHeight;

      return (
        headerHeight + paddingHeight + Math.max(minContentHeight, contentHeight)
      );
    }
  };

  // Helper function to calculate bin-packed layout for desktop
  const calculateGridLayout = () => {
    if (typeof window === "undefined") return [];

    const config = getResponsiveConfig();
    const containerWidth = window.innerWidth - config.containerPadding * 2;
    const noteWidthWithGap = config.noteWidth + config.gridGap;
    const columnsCount = Math.floor(
      (containerWidth + config.gridGap) / noteWidthWithGap
    );
    const actualColumnsCount = Math.max(1, columnsCount);

    // Calculate the actual available width and adjust note width to fill better
    const availableWidthForNotes =
      containerWidth - (actualColumnsCount - 1) * config.gridGap;
    const calculatedNoteWidth = Math.floor(
      availableWidthForNotes / actualColumnsCount
    );
    // Ensure notes don't get too narrow or too wide based on screen size
    const minWidth = config.noteWidth - 40;
    const maxWidth = config.noteWidth + 80;
    const adjustedNoteWidth = Math.max(
      minWidth,
      Math.min(maxWidth, calculatedNoteWidth)
    );

    // Use full width with minimal left offset
    const offsetX = config.containerPadding;

    // Bin-packing algorithm: track the bottom Y position of each column
    const columnBottoms: number[] = new Array(actualColumnsCount).fill(
      config.containerPadding
    );

    return filteredNotes.map((note) => {
      const noteHeight = calculateNoteHeight(
        note,
        adjustedNoteWidth,
        config.notePadding
      );

      // Find the column with the lowest bottom position
      let bestColumn = 0;
      let minBottom = columnBottoms[0];

      for (let col = 1; col < actualColumnsCount; col++) {
        if (columnBottoms[col] < minBottom) {
          minBottom = columnBottoms[col];
          bestColumn = col;
        }
      }

      // Place the note in the best column
      const x = offsetX + bestColumn * (adjustedNoteWidth + config.gridGap);
      const y = columnBottoms[bestColumn];

      // Update the column bottom position
      columnBottoms[bestColumn] = y + noteHeight + config.gridGap;

      return {
        ...note,
        x,
        y,
        width: adjustedNoteWidth,
        height: noteHeight,
      };
    });
  };

  // Helper function to calculate mobile layout (optimized single/double column)
  const calculateMobileLayout = () => {
    if (typeof window === "undefined") return [];

    const config = getResponsiveConfig();
    const containerWidth = window.innerWidth - config.containerPadding * 2;
    const minNoteWidth = config.noteWidth - 20; // Slightly smaller minimum for mobile
    const columnsCount = Math.floor(
      (containerWidth + config.gridGap) / (minNoteWidth + config.gridGap)
    );
    const actualColumnsCount = Math.max(1, columnsCount);

    // Calculate note width for mobile
    const availableWidthForNotes =
      containerWidth - (actualColumnsCount - 1) * config.gridGap;
    const noteWidth = Math.floor(availableWidthForNotes / actualColumnsCount);

    // Bin-packing for mobile with fewer columns
    const columnBottoms: number[] = new Array(actualColumnsCount).fill(
      config.containerPadding
    );

    return filteredNotes.map((note) => {
      const noteHeight = calculateNoteHeight(
        note,
        noteWidth,
        config.notePadding
      );

      // Find the column with the lowest bottom position
      let bestColumn = 0;
      let minBottom = columnBottoms[0];

      for (let col = 1; col < actualColumnsCount; col++) {
        if (columnBottoms[col] < minBottom) {
          minBottom = columnBottoms[col];
          bestColumn = col;
        }
      }

      // Place the note in the best column
      const x =
        config.containerPadding + bestColumn * (noteWidth + config.gridGap);
      const y = columnBottoms[bestColumn];

      // Update the column bottom position
      columnBottoms[bestColumn] = y + noteHeight + config.gridGap;

      return {
        ...note,
        x,
        y,
        width: noteWidth,
        height: noteHeight,
      };
    });
  };

  useEffect(() => {
    const initializeParams = async () => {
      const resolvedParams = await params;
      setBoardId(resolvedParams.id);
    };
    initializeParams();
  }, [params]);

  // Initialize filters from URL on mount
  useEffect(() => {
    initializeFiltersFromURL();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (boardId) {
      fetchBoardData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId]);

  // Close dropdowns when clicking outside and handle escape key
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        showBoardDropdown ||
        showUserDropdown ||
        showAuthorDropdown ||
        showSortDropdown
      ) {
        const target = event.target as Element;
        if (
          !target.closest(".board-dropdown") &&
          !target.closest(".user-dropdown") &&
          !target.closest(".author-dropdown") &&
          !target.closest(".sort-dropdown")
        ) {
          setShowBoardDropdown(false);
          setShowUserDropdown(false);
          setShowAuthorDropdown(false);
          setShowSortDropdown(false);
        }
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (editingNote) {
          setEditingNote(null);
          setEditContent("");
        }
        if (addingChecklistItem) {
          setAddingChecklistItem(null);
          setNewChecklistItemContent("");
        }
        if (editingChecklistItem) {
          setEditingChecklistItem(null);
          setEditingChecklistItemContent("");
        }
        if (showBoardDropdown) {
          setShowBoardDropdown(false);
        }
        if (showUserDropdown) {
          setShowUserDropdown(false);
        }
        if (showAuthorDropdown) {
          setShowAuthorDropdown(false);
        }
        if (showSortDropdown) {
          setShowSortDropdown(false);
        }
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    showBoardDropdown,
    showUserDropdown,
    showAuthorDropdown,
    showSortDropdown,
    editingNote,
    addingChecklistItem,
    editingChecklistItem,
  ]);

  // Enhanced responsive handling with debounced resize and better breakpoints
  useEffect(() => {
    let resizeTimeout: NodeJS.Timeout;

    const checkResponsive = () => {
      if (typeof window !== "undefined") {
        const width = window.innerWidth;
        setIsMobile(width < 768); // Tablet breakpoint

        // Force re-render of notes layout after screen size change
        // This ensures notes are properly repositioned
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
          // Trigger a state update to force re-calculation of note positions
          setNotes((prevNotes) => [...prevNotes]);
        }, 50); // Debounce resize events - reduced for real-time feel
      }
    };

    checkResponsive();
    window.addEventListener("resize", checkResponsive);
    return () => {
      window.removeEventListener("resize", checkResponsive);
      clearTimeout(resizeTimeout);
    };
  }, []);

  // Get unique authors from notes
  const getUniqueAuthors = (notes: Note[]) => {
    const authorsMap = new Map<
      string,
      { id: string; name: string; email: string }
    >();

    notes.forEach((note) => {
      if (!authorsMap.has(note.user.id)) {
        authorsMap.set(note.user.id, {
          id: note.user.id,
          name: note.user.name || note.user.email.split("@")[0],
          email: note.user.email,
        });
      }
    });

    return Array.from(authorsMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  };

  // Filter and sort notes based on search term, date range, author, and sort option
  const filterAndSortNotes = (
    notes: Note[],
    searchTerm: string,
    dateRange: { startDate: Date | null; endDate: Date | null },
    authorId: string | null,
    sortOption: SortOption,
    showDone: boolean,
    currentUser: User | null
  ): Note[] => {
    let filteredNotes = notes;

    // Filter by done status
    if (!showDone) {
      filteredNotes = filteredNotes.filter((note) => !note.done);
    }

    // Filter by search term
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      filteredNotes = filteredNotes.filter((note) => {
        const authorName = (note.user.name || note.user.email).toLowerCase();
        const noteContent = note.content.toLowerCase();
        return authorName.includes(search) || noteContent.includes(search);
      });
    }

    // Filter by author
    if (authorId) {
      filteredNotes = filteredNotes.filter((note) => note.user.id === authorId);
    }

    // Filter by date range
    if (dateRange.startDate || dateRange.endDate) {
      filteredNotes = filteredNotes.filter((note) => {
        const noteDate = new Date(note.createdAt);
        const startOfDay = (date: Date) =>
          new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const endOfDay = (date: Date) =>
          new Date(
            date.getFullYear(),
            date.getMonth(),
            date.getDate(),
            23,
            59,
            59,
            999
          );

        if (dateRange.startDate && dateRange.endDate) {
          return (
            noteDate >= startOfDay(dateRange.startDate) &&
            noteDate <= endOfDay(dateRange.endDate)
          );
        } else if (dateRange.startDate) {
          return noteDate >= startOfDay(dateRange.startDate);
        } else if (dateRange.endDate) {
          return noteDate <= endOfDay(dateRange.endDate);
        }
        return true;
      });
    }

    // Sort notes
    filteredNotes.sort((a, b) => {
      // First priority: logged-in user's notes come first
      if (currentUser) {
        const aIsCurrentUser = a.user.id === currentUser.id;
        const bIsCurrentUser = b.user.id === currentUser.id;

        if (aIsCurrentUser && !bIsCurrentUser) {
          return -1; // a (current user's note) comes first
        }
        if (!aIsCurrentUser && bIsCurrentUser) {
          return 1; // b (current user's note) comes first
        }
      }

      // Second priority: done status (undone notes first) if showing done notes
      if (showDone && a.done !== b.done) {
        return a.done ? 1 : -1; // Undone notes (false) come first
      }

      // Third priority: sort by the selected option
      switch (sortOption) {
        case "created-asc":
          return (
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
        case "created-desc":
          return (
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
        case "author-name":
          const authorNameA = (a.user.name || a.user.email).toLowerCase();
          const authorNameB = (b.user.name || b.user.email).toLowerCase();
          return authorNameA.localeCompare(authorNameB);
        default:
          return (
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
      }
    });

    return filteredNotes;
  };

  // Get unique authors for dropdown
  const uniqueAuthors = getUniqueAuthors(notes);

  // Get filtered and sorted notes for display
  const filteredNotes = filterAndSortNotes(
    notes,
    searchTerm,
    dateRange,
    selectedAuthor,
    sortBy,
    showDoneNotes,
    user
  );

  const fetchBoardData = async () => {
    try {
      // Get user info first to check authentication
      const userResponse = await fetch("/api/user");
      if (userResponse.status === 401) {
        router.push("/auth/signin");
        return;
      }

      if (userResponse.ok) {
        const userData = await userResponse.json();
        setUser(userData);
      }

      // Fetch all boards for the dropdown
      const allBoardsResponse = await fetch("/api/boards");
      if (allBoardsResponse.ok) {
        const { boards } = await allBoardsResponse.json();
        setAllBoards(boards);
      }

      if (boardId === "all-notes") {
        // For all notes view, create a virtual board object and fetch all notes
        setBoard({
          id: "all-notes",
          name: "All notes",
          description: "Notes from all boards",
        });

        // Fetch notes from all boards
        const notesResponse = await fetch(`/api/boards/all-notes/notes`);
        if (notesResponse.ok) {
          const { notes } = await notesResponse.json();
          setNotes(notes);
        }
      } else {
        // Fetch current board info
        const boardResponse = await fetch(`/api/boards/${boardId}`);
        if (boardResponse.status === 401) {
          router.push("/auth/signin");
          return;
        }
        if (boardResponse.ok) {
          const { board } = await boardResponse.json();
          setBoard(board);
        }

        // Fetch notes for specific board
        const notesResponse = await fetch(`/api/boards/${boardId}/notes`);
        if (notesResponse.ok) {
          const { notes } = await notesResponse.json();
          setNotes(notes);
        }
      }

      if (boardId && boardId !== "all-notes") {
        try {
          localStorage.setItem("gumboard-last-visited-board", boardId);
        } catch (error) {
          console.warn("Failed to save last visited board:", error);
        }
      }
    } catch (error) {
      console.error("Error fetching board data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddNote = async (targetBoardId?: string) => {
    // For all notes view, ensure a board is selected
    if (boardId === "all-notes" && !targetBoardId) {
      alert("Please select a board to add the note to");
      return;
    }

    try {
      const actualTargetBoardId =
        boardId === "all-notes" ? targetBoardId : boardId;
      const isAllNotesView = boardId === "all-notes";

      const response = await fetch(
        `/api/boards/${isAllNotesView ? "all-notes" : actualTargetBoardId}/notes`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            content: "",
            ...(isAllNotesView && { boardId: targetBoardId }),
          }),
        }
      );

      if (response.ok) {
        const { note } = await response.json();
        setNotes([...notes, note]);
        setEditingNote(note.id);
        setEditContent("");
      }
    } catch (error) {
      console.error("Error creating note:", error);
    }
  };

  const handleUpdateNote = async (noteId: string, content: string) => {
    try {
      // Find the note to get its board ID for all notes view
      const currentNote = notes.find((n) => n.id === noteId);
      const targetBoardId =
        boardId === "all-notes" && currentNote?.board?.id
          ? currentNote.board.id
          : boardId;

      const response = await fetch(
        `/api/boards/${targetBoardId}/notes/${noteId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ content }),
        }
      );

      if (response.ok) {
        const { note } = await response.json();
        setNotes(notes.map((n) => (n.id === noteId ? note : n)));
        setEditingNote(null);
        setEditContent("");
      } else {
        const errorData = await response.json();
        alert(errorData.error || "Failed to update note");
      }
    } catch (error) {
      console.error("Error updating note:", error);
      alert("Failed to update note");
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!confirm("Are you sure you want to delete this note?")) return;

    try {
      // Find the note to get its board ID for all notes view
      const currentNote = notes.find((n) => n.id === noteId);
      const targetBoardId =
        boardId === "all-notes" && currentNote?.board?.id
          ? currentNote.board.id
          : boardId;

      const response = await fetch(
        `/api/boards/${targetBoardId}/notes/${noteId}`,
        {
          method: "DELETE",
        }
      );

      if (response.ok) {
        setNotes(notes.filter((n) => n.id !== noteId));
      } else {
        const errorData = await response.json();
        alert(errorData.error || "Failed to delete note");
      }
    } catch (error) {
      console.error("Error deleting note:", error);
      alert("Failed to delete note");
    }
  };

  const handleToggleDone = async (noteId: string, currentDone: boolean) => {
    try {
      // Find the note to get its board ID for all notes view
      const currentNote = notes.find((n) => n.id === noteId);
      const targetBoardId =
        boardId === "all-notes" && currentNote?.board?.id
          ? currentNote.board.id
          : boardId;

      const response = await fetch(
        `/api/boards/${targetBoardId}/notes/${noteId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ done: !currentDone }),
        }
      );

      if (response.ok) {
        const { note } = await response.json();
        setNotes(notes.map((n) => (n.id === noteId ? note : n)));
      }
    } catch (error) {
      console.error("Error toggling note done status:", error);
    }
  };

  const handleSignOut = async () => {
    await signOut();
  };

  // Checklist handlers
  const handleConvertToChecklist = async (noteId: string) => {
    try {
      const currentNote = notes.find((n) => n.id === noteId);
      if (!currentNote) return;

      const targetBoardId =
        boardId === "all-notes" && currentNote.board?.id
          ? currentNote.board.id
          : boardId;

      // Create checklist items from existing content, splitting by newlines
      const lines = currentNote.content
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

      const checklistItems: ChecklistItem[] =
        lines.length > 0
          ? lines.map((line, index) => ({
              id: `item-${Date.now()}-${index}`,
              content: line,
              checked: false,
              order: index,
            }))
          : [
              {
                id: `item-${Date.now()}`,
                content: "",
                checked: false,
                order: 0,
              },
            ];

      const response = await fetch(
        `/api/boards/${targetBoardId}/notes/${noteId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            isChecklist: true,
            checklistItems: checklistItems,
          }),
        }
      );

      if (response.ok) {
        const { note } = await response.json();
        setNotes(notes.map((n) => (n.id === noteId ? note : n)));
      }
    } catch (error) {
      console.error("Error converting to checklist:", error);
    }
  };

  const handleAddChecklistItem = async (noteId: string) => {
    if (!newChecklistItemContent.trim()) return;

    try {
      const currentNote = notes.find((n) => n.id === noteId);
      if (!currentNote) return;

      const targetBoardId =
        boardId === "all-notes" && currentNote.board?.id
          ? currentNote.board.id
          : boardId;

      const newItem: ChecklistItem = {
        id: `item-${Date.now()}`,
        content: newChecklistItemContent,
        checked: false,
        order: (currentNote.checklistItems || []).length,
      };

      const updatedItems = [...(currentNote.checklistItems || []), newItem];

      // Check if all items are checked to mark note as done
      const allItemsChecked = updatedItems.every((item) => item.checked);

      const response = await fetch(
        `/api/boards/${targetBoardId}/notes/${noteId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            checklistItems: updatedItems,
            done: allItemsChecked,
          }),
        }
      );

      if (response.ok) {
        const { note } = await response.json();
        setNotes(notes.map((n) => (n.id === noteId ? note : n)));
        setNewChecklistItemContent("");
        // Keep addingChecklistItem active so user can continue adding items
        // setAddingChecklistItem(null) - removed this line
      }
    } catch (error) {
      console.error("Error adding checklist item:", error);
    }
  };

  const handleToggleChecklistItem = async (noteId: string, itemId: string) => {
    try {
      const currentNote = notes.find((n) => n.id === noteId);
      if (!currentNote || !currentNote.checklistItems) return;

      const targetBoardId =
        boardId === "all-notes" && currentNote.board?.id
          ? currentNote.board.id
          : boardId;

      const updatedItems = currentNote.checklistItems.map((item) =>
        item.id === itemId ? { ...item, checked: !item.checked } : item
      );

      // Add item to animating set for visual feedback
      setAnimatingItems((prev) => new Set([...prev, itemId]));

      // Small delay to show animation before reordering
      setTimeout(() => {
        // Sort items: unchecked first, then checked
        const sortedItems = [
          ...updatedItems
            .filter((item) => !item.checked)
            .sort((a, b) => a.order - b.order),
          ...updatedItems
            .filter((item) => item.checked)
            .sort((a, b) => a.order - b.order),
        ];

        // Check if all items are checked to mark note as done
        const allItemsChecked = sortedItems.every((item) => item.checked);

        fetch(`/api/boards/${targetBoardId}/notes/${noteId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            checklistItems: sortedItems,
            done: allItemsChecked,
          }),
        })
          .then((response) => response.json())
          .then(({ note }) => {
            setNotes(notes.map((n) => (n.id === noteId ? note : n)));
            // Remove from animating set after update
            setAnimatingItems((prev) => {
              const newSet = new Set(prev);
              newSet.delete(itemId);
              return newSet;
            });
          });
      }, 200);
    } catch (error) {
      console.error("Error toggling checklist item:", error);
    }
  };

  const handleDeleteChecklistItem = async (noteId: string, itemId: string) => {
    try {
      const currentNote = notes.find((n) => n.id === noteId);
      if (!currentNote || !currentNote.checklistItems) return;

      const targetBoardId =
        boardId === "all-notes" && currentNote.board?.id
          ? currentNote.board.id
          : boardId;

      const updatedItems = currentNote.checklistItems.filter(
        (item) => item.id !== itemId
      );

      // Check if all remaining items are checked to mark note as done
      const allItemsChecked =
        updatedItems.length > 0
          ? updatedItems.every((item) => item.checked)
          : false;

      const response = await fetch(
        `/api/boards/${targetBoardId}/notes/${noteId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            checklistItems: updatedItems,
            done: allItemsChecked,
          }),
        }
      );

      if (response.ok) {
        const { note } = await response.json();
        setNotes(notes.map((n) => (n.id === noteId ? note : n)));
      }
    } catch (error) {
      console.error("Error deleting checklist item:", error);
    }
  };

  const handleEditChecklistItem = async (
    noteId: string,
    itemId: string,
    content: string
  ) => {
    try {
      const currentNote = notes.find((n) => n.id === noteId);
      if (!currentNote || !currentNote.checklistItems) return;

      const targetBoardId =
        boardId === "all-notes" && currentNote.board?.id
          ? currentNote.board.id
          : boardId;

      const updatedItems = currentNote.checklistItems.map((item) =>
        item.id === itemId ? { ...item, content } : item
      );

      // Check if all items are checked to mark note as done
      const allItemsChecked = updatedItems.every((item) => item.checked);

      const response = await fetch(
        `/api/boards/${targetBoardId}/notes/${noteId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            checklistItems: updatedItems,
            done: allItemsChecked,
          }),
        }
      );

      if (response.ok) {
        const { note } = await response.json();
        setNotes(notes.map((n) => (n.id === noteId ? note : n)));
        setEditingChecklistItem(null);
        setEditingChecklistItemContent("");
      }
    } catch (error) {
      console.error("Error editing checklist item:", error);
    }
  };

  const handleToggleAllChecklistItems = async (noteId: string) => {
    try {
      const currentNote = notes.find((n) => n.id === noteId);
      if (!currentNote || !currentNote.checklistItems) return;

      const targetBoardId =
        boardId === "all-notes" && currentNote.board?.id
          ? currentNote.board.id
          : boardId;

      // Check if all items are checked
      const allChecked = currentNote.checklistItems.every(
        (item) => item.checked
      );

      // Toggle all items to opposite state
      const updatedItems = currentNote.checklistItems.map((item) => ({
        ...item,
        checked: !allChecked,
      }));

      // Sort items: unchecked first, then checked
      const sortedItems = [
        ...updatedItems
          .filter((item) => !item.checked)
          .sort((a, b) => a.order - b.order),
        ...updatedItems
          .filter((item) => item.checked)
          .sort((a, b) => a.order - b.order),
      ];

      // The note should be marked as done if all items are checked
      const noteIsDone = !allChecked; // If all were checked before, we're unchecking them (note becomes undone)
      // If not all were checked before, we're checking them all (note becomes done)

      const response = await fetch(
        `/api/boards/${targetBoardId}/notes/${noteId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            checklistItems: sortedItems,
            done: noteIsDone,
          }),
        }
      );

      if (response.ok) {
        const { note } = await response.json();
        setNotes(notes.map((n) => (n.id === noteId ? note : n)));
      }
    } catch (error) {
      console.error("Error toggling all checklist items:", error);
    }
  };

  const handleSplitChecklistItem = async (
    noteId: string,
    itemId: string,
    content: string,
    cursorPosition: number
  ) => {
    try {
      const currentNote = notes.find((n) => n.id === noteId);
      if (!currentNote || !currentNote.checklistItems) return;

      const targetBoardId =
        boardId === "all-notes" && currentNote.board?.id
          ? currentNote.board.id
          : boardId;

      const firstHalf = content.substring(0, cursorPosition).trim();
      const secondHalf = content.substring(cursorPosition).trim();

      if (!secondHalf) {
        await handleEditChecklistItem(noteId, itemId, firstHalf);

        const currentItem = currentNote.checklistItems.find(
          (item) => item.id === itemId
        );
        const currentOrder = currentItem?.order || 0;

        const newItem = {
          id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          content: "",
          checked: false,
          order: currentOrder + 0.5,
        };

        const allItems = [...currentNote.checklistItems, newItem].sort(
          (a, b) => a.order - b.order
        );

        const response = await fetch(
          `/api/boards/${targetBoardId}/notes/${noteId}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              checklistItems: allItems,
            }),
          }
        );

        if (response.ok) {
          const { note } = await response.json();
          setNotes(notes.map((n) => (n.id === noteId ? note : n)));
          setEditingChecklistItem({ noteId, itemId: newItem.id });
          setEditingChecklistItemContent("");
        }
        return;
      }

      // Update current item with first half
      const updatedItems = currentNote.checklistItems.map((item) =>
        item.id === itemId ? { ...item, content: firstHalf } : item
      );

      // Find the current item's order to insert new item after it
      const currentItem = currentNote.checklistItems.find(
        (item) => item.id === itemId
      );
      const currentOrder = currentItem?.order || 0;

      // Create new item with second half
      const newItem = {
        id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        content: secondHalf,
        checked: false,
        order: currentOrder + 0.5,
      };

      const allItems = [...updatedItems, newItem].sort(
        (a, b) => a.order - b.order
      );

      // Update the note with both changes
      const response = await fetch(
        `/api/boards/${targetBoardId}/notes/${noteId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            checklistItems: allItems,
          }),
        }
      );

      if (response.ok) {
        const { note } = await response.json();
        setNotes(notes.map((n) => (n.id === noteId ? note : n)));
        setEditingChecklistItem({ noteId, itemId: newItem.id });
        setEditingChecklistItemContent(secondHalf);
      }
    } catch (error) {
      console.error("Error splitting checklist item:", error);
    }
  };

  if (loading) {
    return <FullPageLoader message="Loading board..." />;
  }

  if (!board && boardId !== "all-notes") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Board not found</div>
      </div>
    );
  }

  const layoutNotes = isMobile
    ? calculateMobileLayout()
    : calculateGridLayout();

  // Calculate the total height needed for the board area
  const calculateBoardHeight = () => {
    if (layoutNotes.length === 0) {
      return "calc(100vh - 64px)"; // Default minimum height when no notes
    }

    // Find the bottommost note position
    const maxBottom = Math.max(
      ...layoutNotes.map((note) => note.y + note.height)
    );
    const minHeight =
      typeof window !== "undefined" && window.innerWidth < 768 ? 500 : 600; // Different min heights for mobile/desktop
    const calculatedHeight = Math.max(minHeight, maxBottom + 100); // Add 100px padding at bottom

    return `${calculatedHeight}px`;
  };

  return (
    <div className="min-h-screen max-w-screen bg-background dark:bg-zinc-950">
      <div className="bg-card dark:bg-zinc-900 border-b border-border dark:border-zinc-800 shadow-sm">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-3">
            {/* Company Name */}
            <Link
              href="/dashboard"
              className="flex-shrink-0 pl-4 sm:pl-2 lg:pl-4"
            >
              <h1 className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                Gumboard
              </h1>
            </Link>

            {/* Board Selector Dropdown */}
            <div className="relative board-dropdown hidden md:block">
              <button
                onClick={() => setShowBoardDropdown(!showBoardDropdown)}
                className="flex items-center border border-border dark:border-zinc-800 space-x-2 text-foreground dark:text-zinc-100 hover:text-foreground dark:hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-zinc-600 rounded-md px-3 py-2 cursor-pointer"
              >
                <div>
                  <div className="text-sm font-semibold text-foreground dark:text-zinc-100">
                    {boardId === "all-notes" ? "All notes" : board?.name}
                  </div>
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-muted-foreground dark:text-zinc-400 transition-transform ${
                    showBoardDropdown ? "rotate-180" : ""
                  }`}
                />
              </button>

              {showBoardDropdown && (
                <div className="absolute left-0 mt-2 w-64 bg-card dark:bg-zinc-900 rounded-md shadow-lg border border-border dark:border-zinc-800 z-50 max-h-80 overflow-y-auto">
                  <div className="py-1">
                    {/* All Notes Option */}
                    <Link
                      href="/boards/all-notes"
                      className={`block px-4 py-2 text-sm hover:bg-accent dark:hover:bg-zinc-800 ${
                        boardId === "all-notes"
                          ? "bg-blue-50 dark:bg-zinc-900/70 text-blue-700 dark:text-blue-300"
                          : "text-foreground dark:text-zinc-100"
                      }`}
                      onClick={() => setShowBoardDropdown(false)}
                    >
                      <div className="font-medium">All notes</div>
                      <div className="text-xs text-muted-foreground dark:text-zinc-400 mt-1">
                        Notes from all boards
                      </div>
                    </Link>
                    {allBoards.length > 0 && (
                      <div className="border-t border-border dark:border-zinc-800 my-1"></div>
                    )}
                    {allBoards.map((b) => (
                      <Link
                        key={b.id}
                        href={`/boards/${b.id}`}
                        className={`block px-4 py-2 text-sm hover:bg-accent dark:hover:bg-zinc-800 ${
                          b.id === boardId
                            ? "bg-blue-50 dark:bg-zinc-900/70 text-blue-700 dark:text-blue-300"
                            : "text-foreground dark:text-zinc-100"
                        }`}
                        onClick={() => setShowBoardDropdown(false)}
                      >
                        <div className="font-medium">{b.name}</div>
                        {b.description && (
                          <div className="text-xs text-muted-foreground dark:text-zinc-400 mt-1">
                            {b.description}
                          </div>
                        )}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Date Range Picker */}
            <div className="hidden lg:block">
              <DateRangePicker
                startDate={dateRange.startDate}
                endDate={dateRange.endDate}
                onDateRangeChange={(startDate, endDate) => {
                  const newDateRange = { startDate, endDate };
                  setDateRange(newDateRange);
                  updateURL(undefined, newDateRange);
                }}
                className="min-w-fit"
              />
            </div>

            {/* Author Filter Dropdown */}
            <div className="relative author-dropdown hidden md:block">
              <button
                onClick={() => {
                  const isFilterDropDownOpen = showSortDropdown;
                  setShowAuthorDropdown(!showAuthorDropdown);
                  if (isFilterDropDownOpen) {
                    setShowSortDropdown(false);
                  }
                }}
                className="flex items-center space-x-2 px-3 py-2 text-sm border border-border dark:border-zinc-800 rounded-md bg-card dark:bg-zinc-900 hover:bg-accent dark:hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-zinc-600 focus:border-transparent transition-colors"
              >
                <User className="w-4 h-4 text-muted-foreground dark:text-zinc-400" />
                <span className="text-foreground dark:text-zinc-100 truncate max-w-32">
                  {selectedAuthor
                    ? uniqueAuthors.find((a) => a.id === selectedAuthor)
                        ?.name || "Unknown author"
                    : "All authors"}
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-muted-foreground dark:text-zinc-400 transition-transform ${
                    showAuthorDropdown ? "rotate-180" : ""
                  }`}
                />
              </button>

              {showAuthorDropdown && (
                <div className="absolute left-0 mt-2 w-64 bg-card dark:bg-zinc-900 rounded-md shadow-lg border border-border dark:border-zinc-800 z-50 max-h-80 overflow-y-auto">
                  <div className="py-1">
                    <button
                      onClick={() => {
                        setSelectedAuthor(null);
                        setShowAuthorDropdown(false);
                        updateURL(undefined, undefined, null);
                      }}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-accent dark:hover:bg-zinc-800 flex items-center space-x-3 ${
                        !selectedAuthor
                          ? "bg-blue-50 dark:bg-zinc-900/70 text-blue-700 dark:text-blue-300"
                          : "text-foreground dark:text-zinc-100"
                      }`}
                    >
                      <User className="w-4 h-4 text-muted-foreground dark:text-zinc-400" />
                      <span className="font-medium">All authors</span>
                    </button>
                    {uniqueAuthors.map((author) => (
                      <button
                        key={author.id}
                        onClick={() => {
                          setSelectedAuthor(author.id);
                          setShowAuthorDropdown(false);
                          updateURL(undefined, undefined, author.id);
                        }}
                        className={`w-full text-left px-4 py-2 text-sm hover:bg-accent dark:hover:bg-zinc-800 flex items-center space-x-3 ${
                          selectedAuthor === author.id
                            ? "bg-blue-50 dark:bg-zinc-900/70 text-blue-700 dark:text-blue-300"
                            : "text-foreground dark:text-zinc-100"
                        }`}
                      >
                        <div className="w-8 h-8 bg-blue-500 dark:bg-zinc-800 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-medium text-white">
                            {author.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-medium truncate">
                            {author.name}
                          </div>
                          <div className="text-xs text-muted-foreground dark:text-zinc-400 truncate">
                            {author.email}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Sort Dropdown */}
            <div className="relative sort-dropdown hidden md:block">
              <button
                onClick={() => {
                  const isAuthorDropDownOpen = showAuthorDropdown;
                  setShowSortDropdown(!showSortDropdown);
                  if (isAuthorDropDownOpen) {
                    setShowAuthorDropdown(false);
                  }
                }}
                className="flex items-center space-x-2 px-3 py-2 text-sm border border-border dark:border-zinc-800 rounded-md bg-card dark:bg-zinc-900 hover:bg-accent dark:hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-zinc-600 focus:border-transparent transition-colors"
              >
                <ArrowUpDown className="w-4 h-4 text-muted-foreground dark:text-zinc-400" />
                <span className="text-foreground dark:text-zinc-100 truncate max-w-32">
                  {SORT_OPTIONS.find((option) => option.value === sortBy)
                    ?.label || "Sort"}
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-muted-foreground dark:text-zinc-400 transition-transform ${
                    showSortDropdown ? "rotate-180" : ""
                  }`}
                />
              </button>

              {showSortDropdown && (
                <div className="absolute left-0 mt-2 w-64 bg-card dark:bg-zinc-900 rounded-md shadow-lg border border-border dark:border-zinc-800 z-50">
                  <div className="py-1">
                    {SORT_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => {
                          setSortBy(option.value);
                          setShowSortDropdown(false);
                          updateURL(
                            undefined,
                            undefined,
                            undefined,
                            option.value
                          );
                        }}
                        className={`w-full text-left px-4 py-2 text-sm hover:bg-accent dark:hover:bg-zinc-800 ${
                          sortBy === option.value
                            ? "bg-blue-50 dark:bg-zinc-900/70 text-blue-700 dark:text-blue-300"
                            : "text-foreground dark:text-zinc-100"
                        }`}
                      >
                        <div className="font-medium">{option.label}</div>
                        <div className="text-xs text-muted-foreground dark:text-zinc-400 mt-1">
                          {option.description}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Show/Hide Completed Notes Toggle */}
            <div className="hidden md:block">
              <button
                onClick={() => {
                  const newShowDone = !showDoneNotes;
                  setShowDoneNotes(newShowDone);
                  updateURL(
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    newShowDone
                  );
                }}
                className={`flex items-center space-x-2 px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-zinc-600 focus:border-transparent transition-colors ${
                  showDoneNotes
                    ? "border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-zinc-900/70 hover:bg-blue-100 dark:hover:bg-zinc-900/80 text-blue-700 dark:text-blue-300"
                    : "border-border dark:border-zinc-800 bg-card dark:bg-zinc-900 hover:bg-accent dark:hover:bg-zinc-800 text-foreground dark:text-zinc-100"
                }`}
                title={
                  showDoneNotes
                    ? "Hide completed notes"
                    : "Show completed notes"
                }
              >
                {showDoneNotes ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
                <span className="truncate max-w-28">
                  {showDoneNotes ? "Hide completed" : "Show completed"}
                </span>
              </button>
            </div>
          </div>

          {/* Right side - Search, Add Note and User dropdown */}
          <div className="flex items-center space-x-2 px-3 ">
            {/* Search Box */}
            <div className="relative hidden sm:block">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-muted-foreground dark:text-zinc-400" />
              </div>
              <input
                type="text"
                placeholder="Search notes..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  updateURL(e.target.value);
                }}
                className="w-64 pl-10 pr-4 py-2 border border-border dark:border-zinc-800 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-zinc-600 focus:border-transparent text-sm bg-background dark:bg-zinc-900 text-foreground dark:text-zinc-100 placeholder:text-muted-foreground dark:placeholder:text-zinc-400"
              />
              {searchTerm && (
                <button
                  onClick={() => {
                    setSearchTerm("");
                    updateURL("");
                  }}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground dark:text-zinc-400 hover:text-foreground dark:hover:text-zinc-100"
                >
                  ×
                </button>
              )}
            </div>

            <Button
              onClick={() => {
                if (boardId === "all-notes" && allBoards.length > 0) {
                  handleAddNote(allBoards[0].id);
                } else {
                  handleAddNote();
                }
              }}
              className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 cursor-pointer font-medium"
            >
              <Pencil className="w-4 h-4" />
            </Button>

            {/* User Dropdown */}
            <div className="relative user-dropdown">
              <button
                onClick={() => setShowUserDropdown(!showUserDropdown)}
                className="flex items-center space-x-2 text-foreground dark:text-gray-200 hover:text-foreground dark:hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:ring-offset-2 dark:focus:ring-offset-gray-800 rounded-md px-2 py-1"
              >
                <div className="w-8 h-8 bg-blue-500 dark:bg-blue-600 rounded-full flex items-center justify-center">
                  <span className="text-sm font-medium text-white">
                    {user?.name
                      ? user.name.charAt(0).toUpperCase()
                      : user?.email?.charAt(0).toUpperCase()}
                  </span>
                </div>
                <span className="text-sm font-medium hidden md:inline">
                  {user?.name?.split(" ")[0] || "User"}
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-muted-foreground dark:text-gray-400 transition-transform ${
                    showUserDropdown ? "rotate-180" : ""
                  }`}
                />
              </button>

              {showUserDropdown && (
                <div className="absolute right-0 mt-2 min-w-fit bg-card dark:bg-gray-800 rounded-md shadow-lg border border-border dark:border-gray-600 z-50">
                  <div className="py-1">
                    <div className="px-4 py-2 text-sm text-muted-foreground dark:text-gray-400 border-b border-border dark:border-gray-600">
                      {user?.email}
                    </div>
                    <Link
                      href="/settings"
                      className="flex items-center px-4 py-2 text-sm text-foreground dark:text-gray-200 hover:bg-accent dark:hover:bg-gray-700"
                      onClick={() => setShowUserDropdown(false)}
                    >
                      <Settings className="w-4 h-4 mr-2" />
                      Settings
                    </Link>
                    <button
                      onClick={handleSignOut}
                      className="flex items-center w-full px-4 py-2 text-sm text-foreground dark:text-gray-200 hover:bg-accent dark:hover:bg-gray-700"
                    >
                      <LogOut className="w-4 h-4 mr-2" />
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Board Title */}
      <div className="md:hidden bg-card dark:bg-gray-800 border-b border-border dark:border-gray-700 px-4 py-3 space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground dark:text-gray-200">
            {boardId === "all-notes" ? "All notes" : board?.name}
          </h2>
          {boardId === "all-notes" ? (
            <p className="text-sm text-muted-foreground dark:text-gray-400">
              Notes from all boards
            </p>
          ) : (
            board?.description && (
              <p className="text-sm text-muted-foreground dark:text-gray-400">
                {board.description}
              </p>
            )
          )}
        </div>

        {/* Mobile Search Box */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-muted-foreground dark:text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search notes..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              updateURL(e.target.value);
            }}
            className="w-full pl-10 pr-4 py-2 border border-border dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent text-sm bg-background dark:bg-gray-700 text-foreground dark:text-gray-200 placeholder:text-muted-foreground dark:placeholder:text-gray-400 shadow-sm"
          />
          {searchTerm && (
            <button
              onClick={() => {
                setSearchTerm("");
                updateURL("");
              }}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground dark:text-gray-400 hover:text-foreground dark:hover:text-gray-200"
            >
              ×
            </button>
          )}
        </div>

        {/* Mobile Date Range Picker */}
        <div className="lg:hidden">
          <DateRangePicker
            startDate={dateRange.startDate}
            endDate={dateRange.endDate}
            onDateRangeChange={(startDate, endDate) => {
              const newDateRange = { startDate, endDate };
              setDateRange(newDateRange);
              updateURL(undefined, newDateRange);
            }}
            className="w-full"
          />
        </div>

        {/* Mobile Author Filter */}
        <div className="md:hidden relative author-dropdown">
          <button
            onClick={() => setShowAuthorDropdown(!showAuthorDropdown)}
            className="w-full flex items-center justify-between px-3 py-2 text-sm border border-border dark:border-gray-600 rounded-md bg-background dark:bg-gray-700 hover:bg-accent dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent transition-colors"
          >
            <div className="flex items-center space-x-2">
              <User className="w-4 h-4 text-muted-foreground dark:text-gray-400" />
              <span className="text-foreground dark:text-gray-200">
                {selectedAuthor
                  ? uniqueAuthors.find((a) => a.id === selectedAuthor)?.name ||
                    "Unknown author"
                  : "All authors"}
              </span>
            </div>
            <ChevronDown
              className={`w-4 h-4 text-muted-foreground dark:text-gray-400 transition-transform ${
                showAuthorDropdown ? "rotate-180" : ""
              }`}
            />
          </button>

          {showAuthorDropdown && (
            <div className="absolute left-0 right-0 mt-2 bg-background dark:bg-gray-800 rounded-md shadow-lg border border-border dark:border-gray-600 z-50 max-h-80 overflow-y-auto">
              <div className="py-1">
                <button
                  onClick={() => {
                    setSelectedAuthor(null);
                    setShowAuthorDropdown(false);
                    updateURL(undefined, undefined, null);
                  }}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-accent dark:hover:bg-gray-700 flex items-center space-x-3 ${
                    !selectedAuthor
                      ? "bg-blue-50 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300"
                      : "text-foreground dark:text-gray-200"
                  }`}
                >
                  <User className="w-4 h-4 text-muted-foreground dark:text-gray-400" />
                  <span className="font-medium">All authors</span>
                </button>
                {uniqueAuthors.map((author) => (
                  <button
                    key={author.id}
                    onClick={() => {
                      setSelectedAuthor(author.id);
                      setShowAuthorDropdown(false);
                      updateURL(undefined, undefined, author.id);
                    }}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-accent dark:hover:bg-gray-700 flex items-center space-x-3 ${
                      selectedAuthor === author.id
                        ? "bg-blue-50 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300"
                        : "text-foreground dark:text-gray-200"
                    }`}
                  >
                    <div className="w-8 h-8 bg-blue-500 dark:bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-medium text-white">
                        {author.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{author.name}</div>
                      <div className="text-xs text-muted-foreground dark:text-gray-400 truncate">
                        {author.email}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Mobile Sort Dropdown */}
        <div className="md:hidden relative sort-dropdown">
          <button
            onClick={() => setShowSortDropdown(!showSortDropdown)}
            className="w-full flex items-center justify-between px-3 py-2 text-sm border border-border dark:border-gray-600 rounded-md bg-background dark:bg-gray-700 hover:bg-accent dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent transition-colors"
          >
            <div className="flex items-center space-x-2">
              <ArrowUpDown className="w-4 h-4 text-muted-foreground dark:text-gray-400" />
              <span className="text-foreground dark:text-gray-200">
                {SORT_OPTIONS.find((option) => option.value === sortBy)
                  ?.label || "Sort"}
              </span>
            </div>
            <ChevronDown
              className={`w-4 h-4 text-muted-foreground dark:text-gray-400 transition-transform ${
                showSortDropdown ? "rotate-180" : ""
              }`}
            />
          </button>

          {showSortDropdown && (
            <div className="absolute left-0 right-0 mt-2 bg-background dark:bg-gray-800 rounded-md shadow-lg border border-border dark:border-gray-600 z-50">
              <div className="py-1">
                {SORT_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => {
                      setSortBy(option.value);
                      setShowSortDropdown(false);
                      updateURL(undefined, undefined, undefined, option.value);
                    }}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-accent dark:hover:bg-gray-700 ${
                      sortBy === option.value
                        ? "bg-blue-50 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300"
                        : "text-foreground dark:text-gray-200"
                    }`}
                  >
                    <div className="font-medium">{option.label}</div>
                    <div className="text-xs text-muted-foreground dark:text-gray-400 mt-1">
                      {option.description}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="md:hidden">
          <button
            onClick={() => {
              const newShowDone = !showDoneNotes;
              setShowDoneNotes(newShowDone);
              updateURL(
                undefined,
                undefined,
                undefined,
                undefined,
                newShowDone
              );
            }}
            className={`w-full flex items-center justify-center space-x-2 px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent transition-colors ${
              showDoneNotes
                ? "border-blue-300 dark:border-zinc-700 bg-blue-50 dark:bg-zinc-900 hover:bg-blue-100 dark:hover:bg-zinc-800 text-blue-700 dark:text-zinc-100"
                : "border-border dark:border-gray-600 bg-background dark:bg-gray-700 hover:bg-accent dark:hover:bg-gray-600 text-foreground dark:text-gray-200"
            }`}
          >
            {showDoneNotes ? (
              <EyeOff className="w-4 h-4" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
            <span>
              {showDoneNotes ? "Hide Completed Notes" : "Show Completed Notes"}
            </span>
          </button>
        </div>
      </div>
      {/* Board Area */}
      <div
        ref={boardRef}
        className="relative w-full bg-gray-50 dark:bg-zinc-950"
        style={{
          height: calculateBoardHeight(),
          minHeight: "calc(100vh - 64px)", // Account for header height
        }}
      >
        {/* Search Results Info */}
        {(searchTerm ||
          dateRange.startDate ||
          dateRange.endDate ||
          selectedAuthor ||
          sortBy !== "created-desc" ||
          showDoneNotes) && (
          <div className="px-4 py-2 bg-blue-50 dark:bg-blue-900/50 border-b border-blue-100 dark:border-blue-800 text-sm text-blue-700 dark:text-blue-300">
            <div className="flex flex-wrap items-center gap-2">
              <span>
                {filteredNotes.length === 1
                  ? `1 note found`
                  : `${filteredNotes.length} notes found`}
              </span>
              {searchTerm && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-800/50 text-blue-800 dark:text-blue-200">
                  Search: &quot;{searchTerm}&quot;
                </span>
              )}
              {selectedAuthor && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-800/50 text-blue-800 dark:text-blue-200">
                  Author:{" "}
                  {uniqueAuthors.find((a) => a.id === selectedAuthor)?.name ||
                    "Unknown"}
                </span>
              )}
              {(dateRange.startDate || dateRange.endDate) && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-800/50 text-blue-800 dark:text-blue-200">
                  Date:{" "}
                  {dateRange.startDate
                    ? dateRange.startDate.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : "..."}{" "}
                  -{" "}
                  {dateRange.endDate
                    ? dateRange.endDate.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : "..."}
                </span>
              )}
              {sortBy !== "created-desc" && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-800/50 text-blue-800 dark:text-blue-200">
                  Sort:{" "}
                  {SORT_OPTIONS.find((option) => option.value === sortBy)
                    ?.label || "Custom"}
                </span>
              )}
              {showDoneNotes && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-800/50 text-blue-800 dark:text-blue-200">
                  Completed notes shown
                </span>
              )}
              <button
                onClick={() => {
                  setSearchTerm("");
                  setDateRange({ startDate: null, endDate: null });
                  setSelectedAuthor(null);
                  setSortBy("created-desc");
                  setShowDoneNotes(false);
                  updateURL(
                    "",
                    { startDate: null, endDate: null },
                    null,
                    "created-desc",
                    false
                  );
                }}
                className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 text-xs underline"
              >
                Clear all filters
              </button>
            </div>
          </div>
        )}

        {/* Notes */}
        <div className="relative w-full h-full">
          {layoutNotes.map((note) => (
            <div
              key={note.id}
              className={`absolute rounded-lg shadow-lg select-none group transition-all duration-200 flex flex-col border border-gray-200 dark:border-gray-600 box-border ${
                note.done ? "opacity-80" : ""
              }`}
              style={{
                backgroundColor:
                  typeof window !== "undefined" &&
                  window.matchMedia &&
                  window.matchMedia("(prefers-color-scheme: dark)").matches
                    ? `${note.color}20`
                    : note.color,
                left: note.x,
                top: note.y,
                width: note.width,
                height: note.height,
                padding: `${getResponsiveConfig().notePadding}px`,
              }}
              onClick={() => {
                // Allow editing if user is the note author or admin
                if (user?.id === note.user.id || user?.isAdmin) {
                  setEditingNote(note.id);
                  setEditContent(note.content);
                }
              }}
            >
              {/* User Info Header */}
              <div className="flex items-start justify-between mb-4 flex-shrink-0">
                <div className="flex items-center space-x-2">
                  <div className="w-7 h-7 bg-white bg-opacity-40 dark:bg-gray-800 dark:bg-opacity-40 rounded-full flex items-center justify-center shadow-sm">
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                      {note.user.name
                        ? note.user.name.charAt(0).toUpperCase()
                        : note.user.email.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-gray-700 dark:text-gray-200 truncate max-w-20">
                      {note.user.name
                        ? note.user.name.split(" ")[0]
                        : note.user.email.split("@")[0]}
                    </span>
                    <div className="flex flex-col">
                      {!note.isChecklist && (
                        <span className="text-xs text-gray-500 dark:text-gray-400 opacity-70">
                          {new Date(note.createdAt).toLocaleDateString(
                            "en-US",
                            {
                              month: "short",
                              day: "numeric",
                              year:
                                new Date(note.createdAt).getFullYear() !==
                                new Date().getFullYear()
                                  ? "numeric"
                                  : undefined,
                            }
                          )}
                        </span>
                      )}
                      {boardId === "all-notes" && note.board && (
                        <span className="text-xs text-blue-600 dark:text-blue-400 opacity-80 font-medium truncate max-w-20">
                          {note.board.name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {/* Show edit/delete buttons for note author or admin */}
                  {(user?.id === note.user.id || user?.isAdmin) && (
                    <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {!note.isChecklist && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingNote(note.id);
                            setEditContent(note.content);
                          }}
                          className="p-1 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded"
                        >
                          <Edit3 className="w-3 h-3" />
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteNote(note.id);
                        }}
                        className="p-1 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                  {/* Beautiful checkbox for done status - show to author or admin */}
                  {(user?.id === note.user.id || user?.isAdmin) && (
                    <div className="flex items-center">
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (note.isChecklist) {
                            handleToggleAllChecklistItems(note.id);
                          } else {
                            handleToggleDone(note.id, note.done);
                          }
                        }}
                        className={`
                          relative w-5 h-5 rounded-md border-2 transition-all duration-200 flex items-center justify-center cursor-pointer hover:scale-110 z-10
                          ${
                            note.done
                              ? "bg-green-500 dark:bg-green-600 border-green-500 dark:border-green-600 text-white shadow-lg opacity-100"
                              : "bg-white dark:bg-gray-800 bg-opacity-60 dark:bg-opacity-60 border-gray-400 dark:border-gray-500 hover:border-green-400 dark:hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 opacity-30 group-hover:opacity-100"
                          }
                        `}
                        title={
                          note.isChecklist
                            ? note.done
                              ? "Uncheck all items"
                              : "Check all items"
                            : note.done
                              ? "Mark as not done"
                              : "Mark as done"
                        }
                        type="button"
                        style={{ pointerEvents: "auto" }}
                      >
                        {note.done && (
                          <svg
                            className="w-3 h-3 text-white"
                            fill="none"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path d="M5 13l4 4L19 7"></path>
                          </svg>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {editingNote === note.id && !note.isChecklist ? (
                <div className="flex-1 min-h-0">
                  <textarea
                    value={editContent}
                    onChange={(e) => {
                      const newValue = e.target.value;
                      setEditContent(newValue);

                      if (newValue.includes("[ ]") && !note.isChecklist) {
                        handleConvertToChecklist(note.id);
                      }
                    }}
                    className="w-full h-full p-2 bg-transparent border-none resize-none focus:outline-none text-base leading-7 text-gray-800 dark:text-gray-200"
                    placeholder="Enter note content..."
                    onBlur={() => handleUpdateNote(note.id, editContent)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && e.ctrlKey) {
                        handleUpdateNote(note.id, editContent);
                      }
                      if (e.key === "Escape") {
                        setEditingNote(null);
                        setEditContent("");
                      }
                      if (e.key === "Backspace" && editContent.trim() === "") {
                        handleDeleteNote(note.id);
                      }
                    }}
                    onFocus={(e) => {
                      // Set cursor at the end of the text
                      const length = e.target.value.length;
                      e.target.setSelectionRange(length, length);
                    }}
                    autoFocus
                  />
                </div>
              ) : note.isChecklist ? (
                <div className="flex-1 overflow-hidden flex flex-col space-y-1">
                  {/* Checklist Items */}
                  {note.checklistItems?.map((item) => (
                    <div
                      key={item.id}
                      className={`flex items-center group/item hover:bg-white dark:hover:bg-gray-800 hover:bg-opacity-40 dark:hover:bg-opacity-40 rounded pr-3 py-1 -ml-0 -mr-0 transition-all duration-200 ${
                        animatingItems.has(item.id) ? "animate-pulse" : ""
                      }`}
                    >
                      {/* Checkbox */}
                      <button
                        onClick={() =>
                          handleToggleChecklistItem(note.id, item.id)
                        }
                        className={`
                          relative w-4 h-4 rounded border-2 transition-all duration-200 flex items-center justify-center cursor-pointer hover:scale-110 mr-3 flex-shrink-0 ml-2
                          ${
                            item.checked
                              ? "bg-green-500 dark:bg-green-600 border-green-500 dark:border-green-600 text-white"
                              : "bg-white dark:bg-gray-800 bg-opacity-60 dark:bg-opacity-60 border-gray-400 dark:border-gray-500 hover:border-green-400 dark:hover:border-green-500"
                          }
                        `}
                      >
                        {item.checked && (
                          <svg
                            className="w-3 h-3 text-white"
                            fill="none"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path d="M5 13l4 4L19 7"></path>
                          </svg>
                        )}
                      </button>

                      {/* Content */}
                      {editingChecklistItem?.noteId === note.id &&
                      editingChecklistItem?.itemId === item.id ? (
                        <input
                          type="text"
                          value={editingChecklistItemContent}
                          onChange={(e) =>
                            setEditingChecklistItemContent(e.target.value)
                          }
                          className="flex-1 bg-transparent border-none outline-none text-sm leading-6 text-gray-800 dark:text-gray-200"
                          onBlur={() =>
                            handleEditChecklistItem(
                              note.id,
                              item.id,
                              editingChecklistItemContent
                            )
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              const target = e.target as HTMLInputElement;
                              const cursorPosition = target.selectionStart || 0;
                              handleSplitChecklistItem(
                                note.id,
                                item.id,
                                editingChecklistItemContent,
                                cursorPosition
                              );
                            }
                            if (e.key === "Escape") {
                              setEditingChecklistItem(null);
                              setEditingChecklistItemContent("");
                            }
                            if (
                              e.key === "Backspace" &&
                              editingChecklistItemContent.trim() === ""
                            ) {
                              handleDeleteChecklistItem(note.id, item.id);
                            }
                          }}
                          autoFocus
                        />
                      ) : (
                        <span
                          className={`flex-1 text-sm leading-6 cursor-pointer ${
                            item.checked
                              ? "text-gray-500 dark:text-gray-400 line-through opacity-70"
                              : "text-gray-800 dark:text-gray-200"
                          }`}
                          onClick={() => {
                            if (user?.id === note.user.id || user?.isAdmin) {
                              setEditingChecklistItem({
                                noteId: note.id,
                                itemId: item.id,
                              });
                              setEditingChecklistItemContent(item.content);
                            }
                          }}
                        >
                          {item.content}
                        </span>
                      )}

                      {/* Delete button */}
                      {(user?.id === note.user.id || user?.isAdmin) && (
                        <button
                          onClick={() =>
                            handleDeleteChecklistItem(note.id, item.id)
                          }
                          className="opacity-0 group-hover/item:opacity-100 transition-opacity p-1 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded ml-2"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))}

                  {/* Add new item input */}
                  {addingChecklistItem === note.id && (
                    <div className="flex items-center group/item hover:bg-white dark:hover:bg-gray-800 hover:bg-opacity-40 dark:hover:bg-opacity-40 rounded-2xl pl-6 pr-3 py-2 -ml-6 -mr-3 mt-2 transition-all duration-200">
                      <div className="w-4 h-4 rounded border-2 border-gray-400 dark:border-gray-500 mr-3 flex-shrink-0 bg-white dark:bg-gray-800 bg-opacity-60 dark:bg-opacity-60 ml-2"></div>
                      <input
                        type="text"
                        value={newChecklistItemContent}
                        onChange={(e) =>
                          setNewChecklistItemContent(e.target.value)
                        }
                        className="flex-1 bg-transparent border-none outline-none text-sm leading-6 text-gray-800 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-400"
                        placeholder="Add new item..."
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            handleAddChecklistItem(note.id);
                          }
                          if (e.key === "Escape") {
                            setAddingChecklistItem(null);
                            setNewChecklistItemContent("");
                          }
                          if (
                            e.key === "Backspace" &&
                            newChecklistItemContent.trim() === ""
                          ) {
                            setAddingChecklistItem(null);
                            setNewChecklistItemContent("");
                          }
                        }}
                        onBlur={() => {
                          if (newChecklistItemContent.trim()) {
                            handleAddChecklistItem(note.id);
                          }
                          // Don't close the input on blur - let user continue adding items
                          // Only close on explicit Escape key
                        }}
                        autoFocus
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex-1 overflow-hidden flex flex-col relative">
                  <p
                    className={`text-base whitespace-pre-wrap break-words leading-7 m-0 p-0 flex-1 transition-all duration-200 ${
                      note.done
                        ? "text-gray-500 dark:text-gray-400 opacity-70 line-through"
                        : "text-gray-800 dark:text-gray-200"
                    }`}
                  >
                    {note.content}
                  </p>
                </div>
              )}

              {(user?.id === note.user.id || user?.isAdmin) &&
                addingChecklistItem !== note.id && (
                  <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2">
                    <button
                      onClick={() => {
                        if (note.isChecklist) {
                          setAddingChecklistItem(note.id);
                        } else {
                          handleConvertToChecklist(note.id);
                        }
                      }}
                      className="rounded-full w-10 h-10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 shadow-lg hover:shadow-xl border-2 border-white dark:border-gray-800"
                      style={{
                        backgroundColor:
                          typeof window !== "undefined" &&
                          window.matchMedia &&
                          window.matchMedia("(prefers-color-scheme: dark)")
                            .matches
                            ? `${note.color}20`
                            : note.color,
                      }}
                      title={
                        note.isChecklist
                          ? "Add checklist item"
                          : "Convert to checklist"
                      }
                    >
                      <div className="bg-white dark:bg-gray-900 rounded-full w-8 h-8 flex items-center justify-center">
                        <Pencil className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                      </div>
                    </button>
                  </div>
                )}
            </div>
          ))}
        </div>

        {/* Empty State */}
        {filteredNotes.length === 0 &&
          notes.length > 0 &&
          (searchTerm ||
            dateRange.startDate ||
            dateRange.endDate ||
            selectedAuthor ||
            !showDoneNotes) && (
            <div className="flex flex-col items-center justify-center h-96 text-gray-500 dark:text-gray-400">
              <Search className="w-12 h-12 mb-4 text-gray-400 dark:text-gray-500" />
              <div className="text-xl mb-2">No notes found</div>
              <div className="text-sm mb-4 text-center">
                No notes match your current filters
                {searchTerm && <div>Search: &quot;{searchTerm}&quot;</div>}
                {selectedAuthor && (
                  <div>
                    Author:{" "}
                    {uniqueAuthors.find((a) => a.id === selectedAuthor)?.name ||
                      "Unknown"}
                  </div>
                )}
                {(dateRange.startDate || dateRange.endDate) && (
                  <div>
                    Date range:{" "}
                    {dateRange.startDate
                      ? dateRange.startDate.toLocaleDateString()
                      : "..."}{" "}
                    -{" "}
                    {dateRange.endDate
                      ? dateRange.endDate.toLocaleDateString()
                      : "..."}
                  </div>
                )}
                {!showDoneNotes && <div>Completed notes are hidden</div>}
              </div>
              <Button
                onClick={() => {
                  setSearchTerm("");
                  setDateRange({ startDate: null, endDate: null });
                  setSelectedAuthor(null);
                  setSortBy("created-desc");
                  setShowDoneNotes(false);
                  updateURL(
                    "",
                    { startDate: null, endDate: null },
                    null,
                    "created-desc",
                    false
                  );
                }}
                variant="outline"
                className="flex items-center space-x-2"
              >
                <span>Clear All Filters</span>
              </Button>
            </div>
          )}

        {notes.length === 0 && (
          <div className="flex flex-col items-center justify-center h-96 text-gray-500 dark:text-gray-400">
            <div className="text-xl mb-2">No notes yet</div>
            <div className="text-sm mb-4">
              Click &ldquo;Add Note&rdquo; to get started
            </div>
            <Button
              onClick={() => {
                if (boardId === "all-notes" && allBoards.length > 0) {
                  handleAddNote(allBoards[0].id);
                } else {
                  handleAddNote();
                }
              }}
              className="flex items-center space-x-2"
            >
              <Pencil className="w-4 h-4" />
              <span>Add Your First Note</span>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
