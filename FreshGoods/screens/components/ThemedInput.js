/**
 * ThemedInput - Reusable text input component with theme styling
 */
import React, { useState } from 'react';
import {
    View,
    TextInput,
    Text,
    StyleSheet,
    TouchableOpacity,
} from 'react-native';
import { colors, spacing, borderRadius, typography } from '../theme';

const ThemedInput = ({
    label,
    value,
    onChangeText,
    placeholder,
    secureTextEntry = false,
    keyboardType = 'default',
    autoCapitalize = 'none',
    multiline = false,
    numberOfLines = 1,
    icon,
    rightIcon,
    onRightIconPress,
    error,
    helperText,
    disabled = false,
    style,
    inputStyle,
    onFocus,
    onBlur,
}) => {
    const [isFocused, setIsFocused] = useState(false);
    const [isPasswordVisible, setIsPasswordVisible] = useState(!secureTextEntry);

    const containerStyles = [
        styles.inputContainer,
        isFocused && styles.focused,
        error && styles.error,
        disabled && styles.disabled,
    ];

    return (
        <View style={[styles.wrapper, style]}>
            {label && <Text style={styles.label}>{label}</Text>}

            <View style={containerStyles}>
                {icon && <Text style={styles.icon}>{icon}</Text>}

                <TextInput
                    style={[styles.input, multiline && styles.multiline, inputStyle]}
                    value={value}
                    onChangeText={onChangeText}
                    placeholder={placeholder}
                    placeholderTextColor={colors.text.muted}
                    secureTextEntry={secureTextEntry && !isPasswordVisible}
                    keyboardType={keyboardType}
                    autoCapitalize={autoCapitalize}
                    multiline={multiline}
                    numberOfLines={numberOfLines}
                    editable={!disabled}
                    onFocus={() => {
                        setIsFocused(true);
                        onFocus?.();
                    }}
                    onBlur={() => {
                        setIsFocused(false);
                        onBlur?.();
                    }}
                    disableFullscreenUI
                />

                {secureTextEntry && (
                    <TouchableOpacity onPress={() => setIsPasswordVisible(!isPasswordVisible)}>
                        <Text style={styles.toggleIcon}>{isPasswordVisible ? '👁️' : '🔒'}</Text>
                    </TouchableOpacity>
                )}

                {rightIcon && !secureTextEntry && (
                    <TouchableOpacity onPress={onRightIconPress}>
                        <Text style={styles.icon}>{rightIcon}</Text>
                    </TouchableOpacity>
                )}
            </View>

            {(error || helperText) && (
                <Text style={[styles.helperText, error && styles.errorText]}>
                    {error || helperText}
                </Text>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    wrapper: {
        marginBottom: spacing.md,
    },
    label: {
        ...typography.bodySmall,
        fontWeight: '600',
        color: colors.text.dark,
        marginBottom: spacing.xs,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderWidth: 1.5,
        borderColor: colors.border.light,
        borderRadius: borderRadius.md,
        paddingHorizontal: spacing.md,
    },
    focused: {
        borderColor: colors.primary,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 2,
    },
    error: {
        borderColor: colors.error,
    },
    disabled: {
        backgroundColor: '#f5f5f5',
        opacity: 0.7,
    },
    icon: {
        fontSize: 18,
        marginRight: spacing.sm,
    },
    toggleIcon: {
        fontSize: 18,
        marginLeft: spacing.sm,
    },
    input: {
        flex: 1,
        paddingVertical: spacing.sm + 4,
        ...typography.body,
        color: colors.text.dark,
    },
    multiline: {
        minHeight: 100,
        textAlignVertical: 'top',
    },
    helperText: {
        ...typography.caption,
        color: colors.text.muted,
        marginTop: spacing.xs,
    },
    errorText: {
        color: colors.error,
    },
});

export default ThemedInput;
