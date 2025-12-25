import { BoundingBox } from '@/Renderer/Positioning/BoundingBox';
export class MathX {
    static clamp(value, min, max) {
        return value < min ? min : (value > max ? max : value);
    }
    static range(start, end, step = 1) {
        const range = [];
        for (let i = start; i <= end; i += step) {
            range.push(i);
        }
        return range;
    }
    static doesRectangleOverlap(objectBox, viewportBox) {
        if (objectBox === null || viewportBox === null) {
            return true;
        }
        if (objectBox.topLeftX < viewportBox.lowerRightX && objectBox.lowerRightX > viewportBox.topLeftX) {
            // There is horizontal overlap
            // Check for vertical overlap
            if (objectBox.topLeftY < viewportBox.lowerRightY && objectBox.lowerRightY > viewportBox.topLeftY) {
                // There is both horizontal and vertical overlap, return true
                return true;
            }
        }
        // No overlap detected, return false
        return false;
    }
    static isPointInRectangle(x, y, rect) {
        return rect !== null && (rect.topLeftX <= x && x <= rect.lowerRightX) && (rect.topLeftY <= y && y <= rect.lowerRightY);
    }
}
