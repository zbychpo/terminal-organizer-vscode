export var swapAdjacent = (array, index, offset) => {
  if (!Array.isArray(array)) {
    return false;
  }
  const targetIndex = index + offset;
  if (index < 0 || index >= array.length || targetIndex < 0 || targetIndex >= array.length) {
    return false;
  }
  const temp = array[index];
  array[index] = array[targetIndex];
  array[targetIndex] = temp;
  return true;
};
