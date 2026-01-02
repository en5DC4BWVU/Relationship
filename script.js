// ============================================
// 個人情報の取り扱いについて
// このファイルには家族の個人情報（名前、生年月日）が含まれます。
// ファイルの共有や公開には十分注意してください。
// ============================================

// 人物データ構造
// IDの振り方: 世代(100の位) + 家族(10の位) + 個人(1の位)
// 例: 第1世代=100番台、第2世代=200番台、第3世代=300番台...
// 家族ごとに10の位で区切り、兄弟は1の位で連番
let familyData = [];

// 展開状態を管理するSet
let expandedNodes = new Set();

// 関係図データを更新する関数
function updateFamilyData(newData) {
    // データの検証
    if (!Array.isArray(newData)) {
        throw new Error('データは配列である必要があります');
    }
    
    // 必須フィールドのチェック
    for (const person of newData) {
        if (!person.id || !person.name || !person.birthDate) {
            throw new Error('各人物には id, name, birthDate が必要です');
        }
    }
    
    // データを更新
    familyData.length = 0;
    familyData.push(...newData);
    
    // 展開状態をリセット（すべて展開）
    expandedNodes = new Set(familyData.map(p => p.id));
}

// 生年月日から年齢を計算
function calculateAge(birthDate) {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        age--;
    }
    return age;
}

// 今日が誕生日かチェック
function isBirthdayToday(birthDate) {
    const today = new Date();
    const birth = new Date(birthDate);
    return today.getMonth() === birth.getMonth() && today.getDate() === birth.getDate();
}

// 日付フォーマット（表示用）
function formatDate(dateString) {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${year}年${month}月${day}日`;
}

// 人物IDから人物オブジェクトを取得
function getPersonById(id) {
    return familyData.find(p => p.id === id);
}

// 人物の世代を取得
function getPersonGeneration(personId) {
    const person = getPersonById(personId);
    if (!person) return 1;

    if (person.parentIds.length > 0) {
        return Math.max(...person.parentIds.map(id => getPersonGeneration(id))) + 1;
    }

    if (person.spouseId) {
        const spouse = getPersonById(person.spouseId);
        if (spouse && spouse.parentIds.length > 0) {
            return Math.max(...spouse.parentIds.map(id => getPersonGeneration(id))) + 1;
        }
    }

    return 1;
}

// 親が展開されているかチェック（再帰的）
function isParentExpanded(personId) {
    const person = getPersonById(personId);
    if (!person) return true;
    
    if (person.parentIds.length === 0) {
        return true;
    }
    
    return person.parentIds.every(parentId => {
        return expandedNodes.has(parentId) && isParentExpanded(parentId);
    });
}

// 兄弟を取得（同じ親を持つ子）
function getSiblings(personId) {
    const person = getPersonById(personId);
    if (!person || person.parentIds.length === 0) return [];
    
    const siblings = new Set();
    person.parentIds.forEach(parentId => {
        const parent = getPersonById(parentId);
        if (parent) {
            parent.childrenIds.forEach(childId => {
                if (childId !== personId) {
                    siblings.add(childId);
                }
            });
        }
    });
    
    return Array.from(siblings);
}

// cytoscapeインスタンス
let cy = null;

// 関係図を描画（完全にcytoscape.jsで）
function renderFamilyTree() {
    const cyContainer = document.getElementById('cy');
    if (!cyContainer) return;
    
    // 既存のcytoscapeインスタンスを破棄
    if (cy) {
        cy.destroy();
        cy = null;
    }
    
    // ノードとエッジのデータを構築
    const nodes = [];
    const edges = [];
    const processedPersons = new Set();
    const createdJunctions = new Set(); // 作成済みの接点ノードを記録
    
    // すべての人物をノードとして追加
    familyData.forEach(person => {
        // 親が展開されている場合のみ表示
        if (!isParentExpanded(person.id)) {
            return;
        }
        
        if (processedPersons.has(person.id)) {
            return;
        }
        
        const age = calculateAge(person.birthDate);
        const isBirthday = isBirthdayToday(person.birthDate);
        const generation = getPersonGeneration(person.id);
        const hasChildren = person.childrenIds.length > 0;
        const isExpanded = expandedNodes.has(person.id);
        
        // ノードラベルを作成
        let label = `${person.name}\n${formatDate(person.birthDate)}\n${age}歳`;
        if (hasChildren) {
            label += `\n${isExpanded ? '▼' : '▶'}`;
        }
        
        // 世代ごとの色を設定
        let backgroundColor = '#ffffff';
        let borderColor = '#dee2e6';
        if (generation === 1) {
            backgroundColor = '#fff5e6';
            borderColor = '#ffa500';
        } else if (generation === 2) {
            backgroundColor = '#e6f3ff';
            borderColor = '#4a90e2';
        } else if (generation === 3) {
            backgroundColor = '#f0f8f0';
            borderColor = '#5cb85c';
        } else if (generation === 4) {
            backgroundColor = '#fff0f5';
            borderColor = '#ff69b4';
        }
        
        if (isBirthday) {
            backgroundColor = '#ffe5e5';
            borderColor = '#e74c3c';
        }
        
        nodes.push({
            data: {
                id: `person_${person.id}`,
                label: label,
                personId: person.id,
                generation: generation,
                hasChildren: hasChildren,
                isExpanded: isExpanded,
                backgroundColor: backgroundColor,
                borderColor: borderColor
            }
        });
        
        processedPersons.add(person.id);
        
        // 配偶者も追加（夫婦を横並びにするため）
        if (person.spouseId && !processedPersons.has(person.spouseId)) {
            const spouse = getPersonById(person.spouseId);
            if (spouse && isParentExpanded(spouse.id)) {
                const spouseAge = calculateAge(spouse.birthDate);
                const spouseIsBirthday = isBirthdayToday(spouse.birthDate);
                const spouseLabel = `${spouse.name}\n${formatDate(spouse.birthDate)}\n${spouseAge}歳`;
                
                let spouseBackgroundColor = backgroundColor;
                let spouseBorderColor = borderColor;
                if (spouseIsBirthday) {
                    spouseBackgroundColor = '#ffe5e5';
                    spouseBorderColor = '#e74c3c';
                }
                
                nodes.push({
                    data: {
                        id: `person_${spouse.id}`,
                        label: spouseLabel,
                        personId: spouse.id,
                        generation: generation,
                        hasChildren: spouse.childrenIds.length > 0,
                        isExpanded: expandedNodes.has(spouse.id),
                        backgroundColor: spouseBackgroundColor,
                        borderColor: spouseBorderColor
                    }
                });
                
                processedPersons.add(spouse.id);
                
                // 夫婦の間に接点ノードを作成（子がいる場合のみ）
                const junctionId = `junction_${Math.min(person.id, spouse.id)}_${Math.max(person.id, spouse.id)}`;
                const hasChildrenTogether = (person.childrenIds.length > 0 || spouse.childrenIds.length > 0) &&
                    (isExpanded || expandedNodes.has(spouse.id));
                
                if (hasChildrenTogether && !createdJunctions.has(junctionId)) {
                    // 接点ノードを作成（見えないノード）
                    nodes.push({
                        data: {
                            id: junctionId,
                            label: '', // ラベルなし
                            isJunction: true, // 接点ノードのフラグ
                            generation: generation // 世代情報を保持
                        }
                    });
                    createdJunctions.add(junctionId);
                    
                    // 夫婦から接点へのエッジ（横線、無向エッジとして設定）
                    edges.push({
                        data: {
                            id: `spouse_${person.id}_${junctionId}`,
                            source: `person_${person.id}`,
                            target: junctionId
                        }
                    });
                    edges.push({
                        data: {
                            id: `spouse_${spouse.id}_${junctionId}`,
                            source: `person_${spouse.id}`,
                            target: junctionId
                        }
                    });
                } else if (!hasChildrenTogether) {
                    // 子がいない場合は直接接続
                    edges.push({
                        data: {
                            id: `spouse_${person.id}_${spouse.id}`,
                            source: `person_${person.id}`,
                            target: `person_${spouse.id}`
                        }
                    });
                }
            }
        }
        
        // 親子関係のエッジを追加
        if (isExpanded && person.childrenIds.length > 0) {
            person.childrenIds.forEach(childId => {
                const child = getPersonById(childId);
                if (child && isParentExpanded(childId)) {
                    // 配偶者がいる場合、接点ノードから子に接続
                    const spouse = person.spouseId ? getPersonById(person.spouseId) : null;
                    const spouseHasSameChild = spouse && spouse.childrenIds.includes(childId);
                    
                    if (spouseHasSameChild) {
                        // 接点ノードから子に接続
                        const junctionId = `junction_${Math.min(person.id, spouse.id)}_${Math.max(person.id, spouse.id)}`;
                        // 接点ノードが作成されているか確認
                        if (createdJunctions.has(junctionId)) {
                            edges.push({
                                data: {
                                    id: `parent_${junctionId}_${childId}`,
                                    source: junctionId,
                                    target: `person_${childId}`
                                }
                            });
                        } else {
                            // 接点ノードがまだ作成されていない場合（配偶者がまだ処理されていない）、直接接続
                            edges.push({
                                data: {
                                    id: `parent_${person.id}_${childId}`,
                                    source: `person_${person.id}`,
                                    target: `person_${childId}`
                                }
                            });
                        }
                    } else {
                        // 片親の場合は直接接続
                        edges.push({
                            data: {
                                id: `parent_${person.id}_${childId}`,
                                source: `person_${person.id}`,
                                target: `person_${childId}`
                            }
                        });
                    }
                }
            });
        }
    });
    
    // すべてのノードの位置を手動で計算
    const nodePositions = new Map(); // ノードID -> 位置のマッピング
    const rankSep = 200; // 世代間の距離
    const nodeSep = 220; // 同じ世代内のノード間の距離（夫婦を考慮）
    
    // 世代ごとにノードをグループ化
    const nodesByGeneration = new Map();
    nodes.forEach(node => {
        let generation = 1;
        if (node.data.isJunction) {
            generation = node.data.generation || 1;
        } else {
            generation = node.data.generation || 1;
        }
        if (!nodesByGeneration.has(generation)) {
            nodesByGeneration.set(generation, []);
        }
        nodesByGeneration.get(generation).push(node);
    });
    
    // 各世代のノードの位置を計算（上から順に処理）
    const sortedGenerations = Array.from(nodesByGeneration.keys()).sort((a, b) => a - b);
    
    sortedGenerations.forEach(generation => {
        // 同じ世代内でのみ重なりチェックを行う
        const placedFamilyGroups = []; // 既に配置された家族グループの情報を保持（同じ世代内のみ）
        const generationNodes = nodesByGeneration.get(generation);
        const y = (generation - 1) * rankSep + 100; // 世代ごとのY座標（上から100px開始）
        
        // 家族グループを特定（夫婦 + 兄弟）
        const familyGroups = [];
        const processedNodeIds = new Set();
        
        generationNodes.forEach(node => {
            if (processedNodeIds.has(node.data.id)) return;
            
            const nodeId = node.data.id;
            const personId = node.data.personId;
            const isJunction = node.data.isJunction;
            
            if (isJunction) {
                // 接点ノードは後で処理
                return;
            }
            
            if (personId) {
                const person = getPersonById(personId);
                if (!person) return;
                
                const familyGroup = [];
                
                // 本人を追加
                familyGroup.push(node);
                processedNodeIds.add(nodeId);
                
                // 配偶者を追加
                if (person.spouseId) {
                    const spouseNode = generationNodes.find(n => n.data.personId === person.spouseId);
                    if (spouseNode && !processedNodeIds.has(spouseNode.data.id)) {
                        familyGroup.push(spouseNode);
                        processedNodeIds.add(spouseNode.data.id);
                    }
                }
                
                // 兄弟を追加（同じ親を持つ子、配偶者なし）
                if (person.parentIds.length > 0) {
                    const siblings = getSiblings(personId);
                    siblings.forEach(siblingId => {
                        const siblingNode = generationNodes.find(n => n.data.personId === siblingId);
                        if (siblingNode && !processedNodeIds.has(siblingNode.data.id)) {
                            const sibling = getPersonById(siblingId);
                            if (sibling && !sibling.spouseId) { // 配偶者なしの兄弟のみ
                                familyGroup.push(siblingNode);
                                processedNodeIds.add(siblingNode.data.id);
                            }
                        }
                    });
                }
                
                // ID順にソート
                familyGroup.sort((a, b) => {
                    const idA = a.data.personId || 0;
                    const idB = b.data.personId || 0;
                    return idA - idB;
                });
                
                if (familyGroup.length > 0) {
                    familyGroups.push(familyGroup);
                }
            }
        });
        
        // 家族グループごとにX座標を計算
        const groupSpacing = 50; // 家族グループ間のスペース
        
        if (generation === 1) {
            // 第1世代は中央寄せで配置（親がいないため）
            const familyGroupWidths = familyGroups.map(familyGroup => {
                return familyGroup.length * nodeSep;
            });
            
            const totalWidth = familyGroupWidths.reduce((sum, width) => sum + width, 0) + 
                              (familyGroups.length - 1) * groupSpacing;
            
            const startX = -totalWidth / 2;
            let currentX = startX;
            
            familyGroups.forEach((familyGroup, groupIndex) => {
                // 家族グループ内のノードを配置
                familyGroup.forEach((node, index) => {
                    const x = currentX + (index * nodeSep);
                    nodePositions.set(node.data.id, { x, y });
                });
                
                // 接点ノードを夫婦の中央に配置
                if (familyGroup.length >= 2) {
                    const person1 = familyGroup[0];
                    const person2 = familyGroup[1];
                    const person1Id = person1.data.personId;
                    const person2Id = person2.data.personId;
                    
                    if (person1Id && person2Id) {
                        const person1Data = getPersonById(person1Id);
                        const person2Data = getPersonById(person2Id);
                        
                        if (person1Data && person2Data && 
                            (person1Data.spouseId === person2Id || person2Data.spouseId === person1Id)) {
                            const junctionId = `junction_${Math.min(person1Id, person2Id)}_${Math.max(person1Id, person2Id)}`;
                            const junctionNode = nodes.find(n => n.data.id === junctionId);
                            
                            if (junctionNode) {
                                const pos1 = nodePositions.get(person1.data.id);
                                const pos2 = nodePositions.get(person2.data.id);
                                if (pos1 && pos2) {
                                    const centerX = (pos1.x + pos2.x) / 2;
                                    nodePositions.set(junctionId, { x: centerX, y: y });
                                }
                            }
                        }
                    }
                }
                
                // 配置された家族グループの情報を記録
                const familyGroupWidth = familyGroupWidths[groupIndex];
                placedFamilyGroups.push({
                    left: currentX,
                    right: currentX + familyGroupWidth,
                    width: familyGroupWidth
                });
                
                currentX += familyGroupWidth + groupSpacing;
            });
        } else {
            // 第2世代以降は親の位置を基準に子を配置
            // 同じ親を持つ家族グループをグループ化
            const familyGroupsByParent = new Map(); // 親のID（接点ノードIDまたは親ノードID） -> 家族グループの配列
            
            familyGroups.forEach(familyGroup => {
                // 家族グループ内のすべての人物の親を確認
                let parentKey = null; // 親を識別するキー
                let parentIds = new Set(); // すべての親IDを収集
                
                familyGroup.forEach(node => {
                    const personId = node.data.personId;
                    const person = getPersonById(personId);
                    if (person && person.parentIds.length > 0) {
                        person.parentIds.forEach(pid => parentIds.add(pid));
                    }
                });
                
                // 親IDから親キーを決定
                const parentIdsArray = Array.from(parentIds);
                if (parentIdsArray.length >= 2) {
                    // 両親がいる場合、接点ノードのIDをキーにする
                    const parent1Id = Math.min(...parentIdsArray);
                    const parent2Id = Math.max(...parentIdsArray);
                    parentKey = `junction_${parent1Id}_${parent2Id}`;
                } else if (parentIdsArray.length === 1) {
                    // 片親の場合、親ノードのIDをキーにする
                    parentKey = `person_${parentIdsArray[0]}`;
                }
                
                if (!familyGroupsByParent.has(parentKey)) {
                    familyGroupsByParent.set(parentKey, []);
                }
                familyGroupsByParent.get(parentKey).push(familyGroup);
            });
            
            // 各親ごとに、その子（家族グループ）を配置
            familyGroupsByParent.forEach((groupsForParent, parentKey) => {
                let parentX = 0;
                
                // 親の位置を取得
                if (parentKey && parentKey.startsWith('junction_')) {
                    const junctionPos = nodePositions.get(parentKey);
                    if (junctionPos) {
                        parentX = junctionPos.x;
                    }
                } else if (parentKey && parentKey.startsWith('person_')) {
                    const parentPos = nodePositions.get(parentKey);
                    if (parentPos) {
                        parentX = parentPos.x;
                    }
                }
                
                // 同じ親を持つ家族グループをID順にソート（配置順序を統一）
                groupsForParent.sort((a, b) => {
                    const idA = a[0].data.personId || 0;
                    const idB = b[0].data.personId || 0;
                    return idA - idB;
                });
                
                // 同じ親の子が1つだけの場合
                if (groupsForParent.length === 1) {
                    const familyGroup = groupsForParent[0];
                    const familyGroupWidth = familyGroup.length * nodeSep;
                    
                    // 理想位置（親の真下）を計算
                    const idealX = parentX - (familyGroupWidth / 2) + (nodeSep / 2);
                    
                    // 理想位置で重なりがないかチェック
                    let hasOverlapAtIdeal = false;
                    for (const placedGroup of placedFamilyGroups) {
                        const familyGroupRight = idealX + familyGroupWidth;
                        if (idealX < placedGroup.right && familyGroupRight > placedGroup.left) {
                            hasOverlapAtIdeal = true;
                            break;
                        }
                    }
                    
                    let adjustedX;
                    if (!hasOverlapAtIdeal) {
                        // 重なっていない場合、理想位置をそのまま使用
                        adjustedX = idealX;
                    } else {
                        // 重なっている場合のみ、シフト処理を実行
                        adjustedX = idealX;
                        
                        // 重なりチェックを複数回実行（すべての重なりが解消されるまで）
                        let hasOverlap = true;
                        let maxIterations = 100;
                        let iterations = 0;
                        
                        while (hasOverlap && iterations < maxIterations) {
                            hasOverlap = false;
                            iterations++;
                            
                            for (const placedGroup of placedFamilyGroups) {
                                const familyGroupRight = adjustedX + familyGroupWidth;
                                if (adjustedX < placedGroup.right && familyGroupRight > placedGroup.left) {
                                    hasOverlap = true;
                                    
                                    const shiftRight = placedGroup.right + groupSpacing;
                                    const shiftLeft = placedGroup.left - groupSpacing - familyGroupWidth;
                                    
                                    const distRight = Math.abs(shiftRight - idealX);
                                    const distLeft = Math.abs(shiftLeft - idealX);
                                    
                                    if (parentX < 0) {
                                        adjustedX = distRight < distLeft ? shiftRight : shiftLeft;
                                    } else if (parentX > 0) {
                                        adjustedX = distLeft < distRight ? shiftLeft : shiftRight;
                                    } else {
                                        adjustedX = distRight < distLeft ? shiftRight : shiftLeft;
                                    }
                                    break;
                                }
                            }
                        }
                    }
                    
                    // 家族グループ内のノードを配置
                    familyGroup.forEach((node, index) => {
                        const x = adjustedX + (index * nodeSep);
                        nodePositions.set(node.data.id, { x, y });
                    });
                    
                    // 接点ノードを夫婦の中央に配置
                    if (familyGroup.length >= 2) {
                        const person1 = familyGroup[0];
                        const person2 = familyGroup[1];
                        const person1Id = person1.data.personId;
                        const person2Id = person2.data.personId;
                        
                        if (person1Id && person2Id) {
                            const person1Data = getPersonById(person1Id);
                            const person2Data = getPersonById(person2Id);
                            
                            if (person1Data && person2Data && 
                                (person1Data.spouseId === person2Id || person2Data.spouseId === person1Id)) {
                                const junctionId = `junction_${Math.min(person1Id, person2Id)}_${Math.max(person1Id, person2Id)}`;
                                const junctionNode = nodes.find(n => n.data.id === junctionId);
                                
                                if (junctionNode) {
                                    const pos1 = nodePositions.get(person1.data.id);
                                    const pos2 = nodePositions.get(person2.data.id);
                                    if (pos1 && pos2) {
                                        const centerX = (pos1.x + pos2.x) / 2;
                                        nodePositions.set(junctionId, { x: centerX, y: y });
                                    }
                                }
                            }
                        }
                    }
                    
                    // 配置された家族グループの情報を記録
                    placedFamilyGroups.push({
                        left: adjustedX,
                        right: adjustedX + familyGroupWidth,
                        width: familyGroupWidth
                    });
                } else {
                    // 同じ親の子が複数ある場合、親の位置を中心に横並びに配置
                    const totalWidthForSiblings = groupsForParent.reduce((sum, group) => {
                        return sum + (group.length * nodeSep);
                    }, 0) + (groupsForParent.length - 1) * groupSpacing;
                    
                    let currentX = parentX - (totalWidthForSiblings / 2) + (nodeSep / 2);
                    
                    groupsForParent.forEach(familyGroup => {
                        const familyGroupWidth = familyGroup.length * nodeSep;
                        let adjustedX = currentX;
                        
                        // 重なりチェックを複数回実行（すべての重なりが解消されるまで）
                        let hasOverlap = true;
                        let maxIterations = 100;
                        let iterations = 0;
                        
                        while (hasOverlap && iterations < maxIterations) {
                            hasOverlap = false;
                            iterations++;
                            
                            for (const placedGroup of placedFamilyGroups) {
                                const familyGroupRight = adjustedX + familyGroupWidth;
                                if (adjustedX < placedGroup.right && familyGroupRight > placedGroup.left) {
                                    hasOverlap = true;
                                    
                                    const idealX = parentX - (familyGroupWidth / 2) + (nodeSep / 2);
                                    const shiftRight = placedGroup.right + groupSpacing;
                                    const shiftLeft = placedGroup.left - groupSpacing - familyGroupWidth;
                                    
                                    const distRight = Math.abs(shiftRight - idealX);
                                    const distLeft = Math.abs(shiftLeft - idealX);
                                    
                                    if (parentX < 0) {
                                        adjustedX = distRight < distLeft ? shiftRight : shiftLeft;
                                    } else if (parentX > 0) {
                                        adjustedX = distLeft < distRight ? shiftLeft : shiftRight;
                                    } else {
                                        adjustedX = distRight < distLeft ? shiftRight : shiftLeft;
                                    }
                                    break;
                                }
                            }
                        }
                        
                        // 家族グループ内のノードを配置
                        familyGroup.forEach((node, index) => {
                            const x = adjustedX + (index * nodeSep);
                            nodePositions.set(node.data.id, { x, y });
                        });
                        
                        // 接点ノードを夫婦の中央に配置
                        if (familyGroup.length >= 2) {
                            const person1 = familyGroup[0];
                            const person2 = familyGroup[1];
                            const person1Id = person1.data.personId;
                            const person2Id = person2.data.personId;
                            
                            if (person1Id && person2Id) {
                                const person1Data = getPersonById(person1Id);
                                const person2Data = getPersonById(person2Id);
                                
                                if (person1Data && person2Data && 
                                    (person1Data.spouseId === person2Id || person2Data.spouseId === person1Id)) {
                                    const junctionId = `junction_${Math.min(person1Id, person2Id)}_${Math.max(person1Id, person2Id)}`;
                                    const junctionNode = nodes.find(n => n.data.id === junctionId);
                                    
                                    if (junctionNode) {
                                        const pos1 = nodePositions.get(person1.data.id);
                                        const pos2 = nodePositions.get(person2.data.id);
                                        if (pos1 && pos2) {
                                            const centerX = (pos1.x + pos2.x) / 2;
                                            nodePositions.set(junctionId, { x: centerX, y: y });
                                        }
                                    }
                                }
                            }
                        }
                        
                        // 配置された家族グループの情報を記録
                        placedFamilyGroups.push({
                            left: adjustedX,
                            right: adjustedX + familyGroupWidth,
                            width: familyGroupWidth
                        });
                        
                        // 次の家族グループの開始位置を更新
                        currentX = adjustedX + familyGroupWidth + groupSpacing;
                    });
                }
            });
        }
    });
    
    // cytoscapeを初期化
    try {
        cy = cytoscape({
        container: cyContainer,
        elements: {
            nodes: nodes,
            edges: edges
        },
        style: [
            {
                selector: 'node[isJunction = "true"]',
                style: {
                    'background-color': '#7f8c8d',
                    'border-color': '#7f8c8d',
                    'border-width': 2,
                    'shape': 'ellipse', // 丸い形状
                    'width': 8,
                    'height': 8,
                    'label': '',
                    'opacity': 1,
                    'text-valign': 'center',
                    'text-halign': 'center',
                    'grabbable': false // ドラッグ不可
                }
            },
            {
                selector: 'node[backgroundColor]',
                style: {
                    'background-color': 'data(backgroundColor)',
                    'border-color': 'data(borderColor)',
                    'border-width': 2,
                    'shape': 'roundrectangle',
                    'width': 180,
                    'height': 100,
                    'text-valign': 'center',
                    'text-halign': 'center',
                    'font-size': 14,
                    'font-family': '-apple-system, BlinkMacSystemFont, "Segoe UI", "Hiragino Kaku Gothic ProN", "Hiragino Sans", Meiryo, sans-serif',
                    'color': '#2c3e50',
                    'text-wrap': 'wrap',
                    'text-max-width': 160,
                    'label': 'data(label)',
                    'grabbable': false // ドラッグ不可
                }
            },
            {
                selector: 'edge',
                style: {
                    'line-color': '#7f8c8d',
                    'width': 3,
                    'curve-style': 'straight',
                    'target-arrow-shape': 'none'
                }
            },
            {
                selector: 'edge[id*="spouse"]',
                style: {
                    'line-color': '#764ba2',
                    'width': 3,
                    'curve-style': 'straight' // 直線スタイル
                }
            },
            {
                selector: 'edge[source*="junction"]',
                style: {
                    'line-color': '#7f8c8d',
                    'width': 3
                }
            }
        ],
        userPanningEnabled: true,
        userZoomingEnabled: true,
        boxSelectionEnabled: false
    });
    
    // 計算した位置をノードに設定（presetレイアウト用）
    // cytoscapeインスタンス作成後に位置を設定する必要がある
    const nodeOriginalPositions = new Map(); // ノードの元の位置を保存
    nodePositions.forEach((position, nodeId) => {
        const cyNode = cy.getElementById(nodeId);
        if (cyNode.length > 0) {
            cyNode.position({ x: position.x, y: position.y });
            nodeOriginalPositions.set(nodeId, { x: position.x, y: position.y });
        }
    });
    
    // 位置が計算されていないノードは、デフォルト位置を設定
    cy.nodes().forEach(node => {
        if (!nodePositions.has(node.id())) {
            node.position({ x: 0, y: 0 });
            nodeOriginalPositions.set(node.id(), { x: 0, y: 0 });
        }
    });
    
    // すべてのノードに対して明示的にgrabbableをfalseに設定
    cy.nodes().forEach(node => {
        node.style('grabbable', false);
    });
    
    // ノードのドラッグを無効化
    cy.on('grab', 'node', function(evt) {
        evt.preventDefault(); // ドラッグを防止
    });
    
    cy.on('drag', 'node', function(evt) {
        const node = evt.target;
        // 元の位置に戻す
        const originalPos = nodeOriginalPositions.get(node.id());
        if (originalPos) {
            node.position(originalPos);
        }
    });
    
    // ノードクリックイベント（展開/折りたたみ）
    cy.on('tap', 'node', function(evt) {
        const node = evt.target;
        const personId = node.data('personId');
        const hasChildren = node.data('hasChildren');
        
        if (hasChildren && personId) {
            const person = getPersonById(personId);
            if (person && person.childrenIds.length > 0) {
                const isExpanded = expandedNodes.has(personId);
                
                if (isExpanded) {
                    expandedNodes.delete(personId);
                } else {
                    expandedNodes.add(personId);
                }
                
                // 再描画
                renderFamilyTree();
            }
        }
    });
    
    // presetレイアウトを使用（位置は既に計算済み）
    const layout = cy.layout({
        name: 'preset'
    });
    
    layout.one('layoutstop', () => {
        // 初期表示を中央に
        cy.fit(50); // 50pxの余白を確保
    });
    
    layout.run();
    } catch (e) {
        console.error('cytoscape初期化エラー:', e);
        // dagreが利用できない場合、breadthfirstを使用して再試行
        if (e.message && e.message.includes('dagre')) {
            console.warn('dagreレイアウトが利用できません。breadthfirstレイアウトを使用します。');
            cy = cytoscape({
                container: cyContainer,
                elements: {
                    nodes: nodes,
                    edges: edges
                },
                style: [
                    {
                        selector: 'node',
                        style: {
                            'background-color': 'data(backgroundColor)',
                            'border-color': 'data(borderColor)',
                            'border-width': 2,
                            'shape': 'roundrectangle',
                            'width': 180,
                            'height': 100,
                            'text-valign': 'center',
                            'text-halign': 'center',
                            'font-size': 14,
                            'font-family': '-apple-system, BlinkMacSystemFont, "Segoe UI", "Hiragino Kaku Gothic ProN", "Hiragino Sans", Meiryo, sans-serif',
                            'color': '#2c3e50',
                            'text-wrap': 'wrap',
                            'text-max-width': 160,
                            'label': 'data(label)',
                            'grabbable': false // ドラッグ不可
                        }
                    },
                    {
                        selector: 'edge',
                        style: {
                            'line-color': '#7f8c8d',
                            'width': 3,
                            'curve-style': 'straight',
                            'target-arrow-shape': 'none'
                        }
                    },
                    {
                        selector: 'edge[id*="spouse"]',
                        style: {
                            'line-color': '#764ba2',
                            'width': 3
                        }
                    }
                ],
                layout: {
                    name: 'breadthfirst',
                    directed: true,
                    roots: familyData.filter(p => p.parentIds.length === 0).map(p => `person_${p.id}`),
                    spacingFactor: 1.5
                },
                userPanningEnabled: true,
                userZoomingEnabled: true,
                boxSelectionEnabled: false
            });
            
            // ノードのドラッグを無効化
            cy.on('grab', 'node', function(evt) {
                evt.preventDefault(); // ドラッグを防止
            });
            
            cy.on('drag', 'node', function(evt) {
                const node = evt.target;
                // 元の位置に戻す
                const originalPos = nodePositions.get(node.id());
                if (originalPos) {
                    node.position(originalPos);
                }
            });
            
            // ノードクリックイベント（展開/折りたたみ）
            cy.on('tap', 'node', function(evt) {
                const node = evt.target;
                const personId = node.data('personId');
                const hasChildren = node.data('hasChildren');
                
                if (hasChildren && personId) {
                    const person = getPersonById(personId);
                    if (person && person.childrenIds.length > 0) {
                        const isExpanded = expandedNodes.has(personId);
                        
                        if (isExpanded) {
                            expandedNodes.delete(personId);
                        } else {
                            expandedNodes.add(personId);
                        }
                        
                        // 再描画
                        renderFamilyTree();
                    }
                }
            });
            
            // ノードのドラッグを無効化（フォールバック用）
            cy.on('grab', 'node', function(evt) {
                evt.preventDefault(); // ドラッグを防止
            });
            
            cy.on('drag', 'node', function(evt) {
                const node = evt.target;
                // 元の位置を取得して戻す
                const pos = node.position();
                // ドラッグ開始時の位置を保存（初回のみ）
                if (!node.data('originalX')) {
                    node.data('originalX', pos.x);
                    node.data('originalY', pos.y);
                }
                // 元の位置に戻す
                node.position({ x: node.data('originalX'), y: node.data('originalY') });
            });
            
            cy.ready(() => {
                cy.fit(50);
            });
        } else {
            throw e;
        }
    }
}

// JSON読み込み処理
function loadJsonData() {
    const jsonInput = document.getElementById('jsonInput');
    const errorMessage = document.getElementById('errorMessage');
    const errorDiv = errorMessage;
    
    try {
        const jsonText = jsonInput.value.trim();
        if (!jsonText) {
            throw new Error('家族の情報が入力されていません。テキストボックスに情報を貼り付けてください。');
        }
        
        const parsedData = JSON.parse(jsonText);
        updateFamilyData(parsedData);
        
        // エラーメッセージを非表示
        errorDiv.style.display = 'none';
        errorDiv.innerHTML = '';
        
        // 関係図を再描画
        renderFamilyTree();
        
        // 成功メッセージを表示（3秒後に自動で消える）
        errorDiv.className = 'alert alert-success mt-3';
        errorDiv.innerHTML = '<strong>✓ 成功しました！</strong> 家族の関係図が表示されました。';
        errorDiv.style.display = 'block';
        setTimeout(() => {
            errorDiv.style.display = 'none';
        }, 3000);
        
        // 関係図の表示エリアまで自動スクロール
        setTimeout(() => {
            const treeViewport = document.querySelector('.tree-viewport');
            if (treeViewport) {
                treeViewport.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }, 100); // 描画が完了するまで少し待つ
        
        console.log('データを読み込みました');
    } catch (error) {
        // エラーメッセージを表示（初心者向けにわかりやすく）
        errorDiv.className = 'alert alert-danger mt-3';
        let errorText = '';
        
        if (error.message.includes('JSON')) {
            errorText = '<strong>⚠ エラーが発生しました</strong><br>入力された情報の形式が正しくないようです。<br>もう一度、正しい形式の情報をコピー＆ペーストしてください。';
        } else if (error.message.includes('配列')) {
            errorText = '<strong>⚠ エラーが発生しました</strong><br>家族の情報が正しい形式ではありません。<br>サンプルデータを参考に、正しい形式で入力してください。';
        } else {
            errorText = '<strong>⚠ エラーが発生しました</strong><br>' + error.message + '<br>もう一度確認してから、再度お試しください。';
        }
        
        errorDiv.innerHTML = errorText;
        errorDiv.style.display = 'block';
        console.error('JSON読み込みエラー:', error);
    }
}

// 初期表示に戻す
function resetView() {
    if (!cy) {
        return;
    }
    
    try {
        // 初期表示位置とサイズに戻す
        cy.fit(50); // 50pxの余白を確保
    } catch (error) {
        console.error('表示リセットエラー:', error);
    }
}

// 画像で保存
function saveAsImage() {
    if (!cy) {
        alert('関係図が表示されていません');
        return;
    }
    
    try {
        // Cytoscapeの画像エクスポート機能を使用
        // base64文字列として取得
        const pngBase64 = cy.png({
            output: 'base64',
            bg: 'white',
            full: true // 全体を画像に含める
        });
        
        // base64文字列を処理（data:image/png;base64, のプレフィックスを除去）
        const base64Data = pngBase64.includes(',') ? pngBase64.split(',')[1] : pngBase64;
        
        // base64をBlobに変換
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'image/png' });
        
        // Blob URLを作成してダウンロード
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = '関係図_' + new Date().toISOString().slice(0, 10) + '.png';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error('画像保存エラー:', error);
        alert('画像の保存に失敗しました: ' + error.message);
    }
}

// スマホでのダブルタップズームを防ぐ
document.addEventListener('touchstart', function(event) {
    if (event.touches.length > 1) {
        event.preventDefault();
    }
}, { passive: false });

let lastTouchEnd = 0;
document.addEventListener('touchend', function(event) {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) {
        event.preventDefault();
    }
    lastTouchEnd = now;
}, { passive: false });

// 初期化
document.addEventListener('DOMContentLoaded', () => {
    // 初期データを設定（空の配列）
    updateFamilyData(familyData);
    
    // テキストエリアはプレースホルダーのみ（初期値は空）
    const jsonInput = document.getElementById('jsonInput');
    jsonInput.value = '';
    
    // イベントリスナーを設定
    document.getElementById('loadButton').addEventListener('click', loadJsonData);
    document.getElementById('saveImageButton').addEventListener('click', saveAsImage);
    document.getElementById('resetViewButton').addEventListener('click', resetView);
    
    // 関係図は初期状態では表示しない（データがないため）
    // renderFamilyTree();
});
