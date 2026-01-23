export class CircularBuffer<T> {
    private buffer: T[];
    private head: number = 0;
    private size: number = 0;

    constructor(private capacity: number) {
        this.buffer = new Array(capacity);
    }

    push(item: T): void {
        if (this.capacity === 0) { return; }
        if (this.size < this.capacity) {
            this.buffer[this.size++] = item;
        } else {
            this.buffer[this.head] = item;
            this.head = (this.head + 1) % this.capacity;
        }
    }

    getAll(): T[] {
        if (this.size === 0) { return []; }
        if (this.size < this.capacity) {
            return this.buffer.slice(0, this.size);
        }
        // Reconstruct in order: from head to end, then 0 to head
        return [
            ...this.buffer.slice(this.head),
            ...this.buffer.slice(0, this.head)
        ];
    }

    clear(): void {
        this.head = 0;
        this.size = 0;
    }

    get length(): number {
        return this.size;
    }
}
