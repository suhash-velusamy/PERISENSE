/**
 * RatingSystem.js
 * Rate drivers/vendors after delivery completion
 */

import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    Modal,
    Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';
import { IPADD } from '../ipadd';
import {
    colors,
    gradients,
    spacing,
    borderRadius,
    typography,
    shadows,
} from '../theme';
import ThemedButton from './ThemedButton';
import { FadeInView } from './AnimatedComponents';

// ═══════════════════════════════════════════════════════════════════
// STAR RATING COMPONENT
// ═══════════════════════════════════════════════════════════════════
const StarRating = ({ rating, onRatingChange, size = 40, readonly = false }) => {
    const stars = [1, 2, 3, 4, 5];

    return (
        <View style={styles.starsContainer}>
            {stars.map((star) => (
                <TouchableOpacity
                    key={star}
                    onPress={() => !readonly && onRatingChange(star)}
                    disabled={readonly}
                    activeOpacity={readonly ? 1 : 0.7}
                >
                    <Text style={[styles.star, { fontSize: size }]}>
                        {star <= rating ? '⭐' : '☆'}
                    </Text>
                </TouchableOpacity>
            ))}
        </View>
    );
};

// ═══════════════════════════════════════════════════════════════════
// QUICK FEEDBACK CHIPS
// ═══════════════════════════════════════════════════════════════════
const POSITIVE_TAGS = [
    'Fast Delivery',
    'Good Communication',
    'Careful Handling',
    'Professional',
    'On Time',
];

const NEGATIVE_TAGS = [
    'Slow Delivery',
    'Poor Communication',
    'Damaged Goods',
    'Unprofessional',
    'Late',
];

const FeedbackChips = ({ selectedTags, onToggleTag, isPositive }) => {
    const tags = isPositive ? POSITIVE_TAGS : NEGATIVE_TAGS;

    return (
        <View style={styles.chipsContainer}>
            {tags.map((tag) => {
                const isSelected = selectedTags.includes(tag);
                return (
                    <TouchableOpacity
                        key={tag}
                        style={[
                            styles.chip,
                            isSelected && (isPositive ? styles.chipPositive : styles.chipNegative),
                        ]}
                        onPress={() => onToggleTag(tag)}
                        activeOpacity={0.7}
                    >
                        <Text
                            style={[
                                styles.chipText,
                                isSelected && styles.chipTextSelected,
                            ]}
                        >
                            {tag}
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    );
};

// ═══════════════════════════════════════════════════════════════════
// RATING MODAL
// ═══════════════════════════════════════════════════════════════════
const RatingModal = ({
    visible,
    onClose,
    targetId,
    targetName,
    targetType = 'driver', // 'driver' or 'vendor'
    exportId,
    onSuccess,
}) => {
    const [rating, setRating] = useState(0);
    const [selectedTags, setSelectedTags] = useState([]);
    const [comment, setComment] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const toggleTag = (tag) => {
        setSelectedTags((prev) =>
            prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
        );
    };

    const handleSubmit = async () => {
        if (rating === 0) {
            Alert.alert('Required', 'Please select a rating');
            return;
        }

        setSubmitting(true);
        try {
            // TODO: Replace with actual API endpoint
            // await axios.post(`${IPADD}/api/ratings`, {
            //   targetId,
            //   targetType,
            //   exportId,
            //   rating,
            //   tags: selectedTags,
            //   comment,
            // });

            // Simulate API call
            await new Promise((r) => setTimeout(r, 1000));

            Alert.alert('Thank You!', 'Your feedback has been submitted.');
            onSuccess?.();
            onClose();
        } catch (err) {
            console.error('Rating error:', err);
            Alert.alert('Error', 'Failed to submit rating. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleClose = () => {
        setRating(0);
        setSelectedTags([]);
        setComment('');
        onClose();
    };

    const isPositive = rating >= 4;

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent
            onRequestClose={handleClose}
        >
            <View style={styles.modalOverlay}>
                <FadeInView style={styles.modalContent}>
                    {/* Header */}
                    <View style={styles.modalHeader}>
                        <TouchableOpacity onPress={handleClose}>
                            <Text style={styles.closeButton}>✕</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Icon & Title */}
                    <View style={styles.heroSection}>
                        <Text style={styles.heroEmoji}>
                            {rating === 0 ? '🤔' : rating >= 4 ? '😊' : rating >= 3 ? '😐' : '😔'}
                        </Text>
                        <Text style={styles.heroTitle}>Rate Your Experience</Text>
                        <Text style={styles.heroSubtitle}>
                            How was your delivery with {targetName}?
                        </Text>
                    </View>

                    {/* Star Rating */}
                    <StarRating rating={rating} onRatingChange={setRating} />

                    {/* Rating Label */}
                    {rating > 0 && (
                        <Text style={styles.ratingLabel}>
                            {rating === 5 && 'Excellent!'}
                            {rating === 4 && 'Good'}
                            {rating === 3 && 'Average'}
                            {rating === 2 && 'Poor'}
                            {rating === 1 && 'Very Poor'}
                        </Text>
                    )}

                    {/* Feedback Chips */}
                    {rating > 0 && (
                        <View style={styles.feedbackSection}>
                            <Text style={styles.feedbackTitle}>
                                {isPositive ? 'What went well?' : 'What could be improved?'}
                            </Text>
                            <FeedbackChips
                                selectedTags={selectedTags}
                                onToggleTag={toggleTag}
                                isPositive={isPositive}
                            />
                        </View>
                    )}

                    {/* Comment Box */}
                    {rating > 0 && (
                        <TextInput
                            style={styles.commentInput}
                            placeholder="Add a comment (optional)"
                            placeholderTextColor={colors.text.muted}
                            value={comment}
                            onChangeText={setComment}
                            multiline
                            numberOfLines={3}
                            maxLength={500}
                        />
                    )}

                    {/* Submit Button */}
                    <ThemedButton
                        title={submitting ? 'Submitting...' : 'Submit Rating'}
                        variant="gradient"
                        onPress={handleSubmit}
                        disabled={rating === 0 || submitting}
                        loading={submitting}
                        fullWidth
                        style={styles.submitButton}
                    />
                </FadeInView>
            </View>
        </Modal>
    );
};

// ═══════════════════════════════════════════════════════════════════
// RATING DISPLAY (for showing existing ratings)
// ═══════════════════════════════════════════════════════════════════
export const RatingDisplay = ({ rating, count, size = 16 }) => (
    <View style={styles.ratingDisplay}>
        <Text style={[styles.ratingValue, { fontSize: size }]}>
            {rating?.toFixed(1) || '0.0'}
        </Text>
        <StarRating rating={Math.round(rating || 0)} size={size * 0.9} readonly />
        {count !== undefined && (
            <Text style={styles.ratingCount}>({count})</Text>
        )}
    </View>
);

// ═══════════════════════════════════════════════════════════════════
// RATING PROMPT CARD
// ═══════════════════════════════════════════════════════════════════
export const RatingPromptCard = ({ exportData, onRate }) => (
    <TouchableOpacity
        style={styles.promptCard}
        onPress={() => onRate(exportData)}
        activeOpacity={0.8}
    >
        <LinearGradient
            colors={[colors.tertiary + '20', colors.primary + '20']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.promptGradient}
        >
            <Text style={styles.promptEmoji}>⭐</Text>
            <View style={styles.promptContent}>
                <Text style={styles.promptTitle}>Rate Your Delivery</Text>
                <Text style={styles.promptSubtitle}>
                    Tell us about your experience
                </Text>
            </View>
            <Text style={styles.promptArrow}>›</Text>
        </LinearGradient>
    </TouchableOpacity>
);

// ═══════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: colors.background.card,
        borderTopLeftRadius: borderRadius.xl,
        borderTopRightRadius: borderRadius.xl,
        paddingBottom: spacing.xxl,
        maxHeight: '90%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        padding: spacing.md,
    },
    closeButton: {
        fontSize: 24,
        color: colors.text.muted,
        padding: spacing.sm,
    },
    heroSection: {
        alignItems: 'center',
        paddingHorizontal: spacing.xl,
        paddingBottom: spacing.lg,
    },
    heroEmoji: {
        fontSize: 64,
        marginBottom: spacing.md,
    },
    heroTitle: {
        ...typography.h2,
        color: colors.text.primary,
        marginBottom: spacing.xs,
    },
    heroSubtitle: {
        ...typography.body,
        color: colors.text.secondary,
        textAlign: 'center',
    },
    starsContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        paddingVertical: spacing.md,
    },
    star: {
        marginHorizontal: spacing.xs,
    },
    ratingLabel: {
        ...typography.bodyMedium,
        color: colors.primary,
        textAlign: 'center',
        marginTop: spacing.sm,
    },
    feedbackSection: {
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.lg,
    },
    feedbackTitle: {
        ...typography.bodyMedium,
        color: colors.text.primary,
        marginBottom: spacing.md,
    },
    chipsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
    },
    chip: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.round,
        borderWidth: 1,
        borderColor: colors.border.medium,
        backgroundColor: colors.background.secondary,
    },
    chipPositive: {
        backgroundColor: colors.successBg,
        borderColor: colors.success,
    },
    chipNegative: {
        backgroundColor: colors.errorBg,
        borderColor: colors.error,
    },
    chipText: {
        ...typography.bodySmall,
        color: colors.text.secondary,
    },
    chipTextSelected: {
        fontWeight: '600',
    },
    commentInput: {
        ...typography.body,
        color: colors.text.primary,
        backgroundColor: colors.background.secondary,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        marginHorizontal: spacing.lg,
        marginTop: spacing.lg,
        minHeight: 80,
        textAlignVertical: 'top',
    },
    submitButton: {
        marginHorizontal: spacing.lg,
        marginTop: spacing.lg,
    },
    ratingDisplay: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    ratingValue: {
        fontWeight: 'bold',
        color: colors.text.primary,
        marginRight: spacing.xs,
    },
    ratingCount: {
        ...typography.caption,
        color: colors.text.muted,
        marginLeft: spacing.xs,
    },
    promptCard: {
        marginHorizontal: spacing.md,
        borderRadius: borderRadius.lg,
        overflow: 'hidden',
        ...shadows.sm,
    },
    promptGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.md,
    },
    promptEmoji: {
        fontSize: 32,
        marginRight: spacing.md,
    },
    promptContent: {
        flex: 1,
    },
    promptTitle: {
        ...typography.bodyMedium,
        color: colors.text.primary,
    },
    promptSubtitle: {
        ...typography.caption,
        color: colors.text.secondary,
    },
    promptArrow: {
        fontSize: 24,
        color: colors.text.muted,
    },
});

export { StarRating };
export default RatingModal;
